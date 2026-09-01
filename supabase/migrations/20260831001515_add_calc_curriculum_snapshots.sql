-- Compact, rebuildable progress snapshots for finite calc curricula.
-- One row per user/block replaces one row per completed formula.

CREATE TABLE public.calc_curriculum_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  curriculum_version text NOT NULL,
  universe_size integer NOT NULL CHECK (universe_size > 0),
  covered_bits bytea NOT NULL,
  within_target_bits bytea NOT NULL,
  fluent_bits bytea NOT NULL,
  mastered_bits bytea NOT NULL,
  covered_count integer NOT NULL DEFAULT 0 CHECK (covered_count >= 0),
  within_target_count integer NOT NULL DEFAULT 0 CHECK (within_target_count >= 0),
  fluent_count integer NOT NULL DEFAULT 0 CHECK (fluent_count >= 0),
  mastered_count integer NOT NULL DEFAULT 0 CHECK (mastered_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, block_id),
  CONSTRAINT calc_curriculum_snapshot_counts_fit CHECK (
    covered_count <= universe_size
    AND within_target_count <= universe_size
    AND fluent_count <= universe_size
    AND mastered_count <= universe_size
  ),
  CONSTRAINT calc_curriculum_snapshot_bytes_fit CHECK (
    octet_length(covered_bits) = (universe_size + 7) / 8
    AND octet_length(within_target_bits) = (universe_size + 7) / 8
    AND octet_length(fluent_bits) = (universe_size + 7) / 8
    AND octet_length(mastered_bits) = (universe_size + 7) / 8
  )
);

ALTER TABLE public.calc_curriculum_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY calc_curriculum_snapshots_select_own
  ON public.calc_curriculum_snapshots
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY calc_curriculum_snapshots_insert_own
  ON public.calc_curriculum_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY calc_curriculum_snapshots_update_own
  ON public.calc_curriculum_snapshots
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.calc_curriculum_snapshots TO authenticated;

-- Each payload item is the current evidence-derived state for one finite formula.
-- Covered/within-target are durable achievements; fluent/mastered mirror current state
-- and may therefore be cleared after regression. The update is atomic per statement.
CREATE OR REPLACE FUNCTION public.merge_calc_curriculum_snapshot(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  owner_id uuid := auth.uid();
  target_block text;
  target_version text;
  target_size integer;
  target_index integer;
  zero_bits bytea;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'p_items must be an array of at most 500 items' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    target_block := item->>'block_id';
    target_version := item->>'curriculum_version';
    target_size := (item->>'universe_size')::integer;
    target_index := (item->>'curriculum_index')::integer;

    IF target_block IS NULL OR target_block = '' OR target_version IS NULL OR target_version = ''
       OR target_size IS NULL OR target_size <= 0
       OR target_index IS NULL OR target_index < 0 OR target_index >= target_size THEN
      RAISE EXCEPTION 'invalid curriculum snapshot item: %', item USING ERRCODE = '22023';
    END IF;

    zero_bits := decode(repeat('00', (target_size + 7) / 8), 'hex');

    INSERT INTO public.calc_curriculum_snapshots (
      user_id, block_id, curriculum_version, universe_size,
      covered_bits, within_target_bits, fluent_bits, mastered_bits
    ) VALUES (
      owner_id, target_block, target_version, target_size,
      zero_bits, zero_bits, zero_bits, zero_bits
    )
    ON CONFLICT (user_id, block_id) DO UPDATE SET
      curriculum_version = EXCLUDED.curriculum_version,
      universe_size = EXCLUDED.universe_size,
      covered_bits = CASE
        WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
         AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.covered_bits ELSE EXCLUDED.covered_bits END,
      within_target_bits = CASE
        WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
         AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.within_target_bits ELSE EXCLUDED.within_target_bits END,
      fluent_bits = CASE
        WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
         AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.fluent_bits ELSE EXCLUDED.fluent_bits END,
      mastered_bits = CASE
        WHEN public.calc_curriculum_snapshots.curriculum_version = EXCLUDED.curriculum_version
         AND public.calc_curriculum_snapshots.universe_size = EXCLUDED.universe_size
        THEN public.calc_curriculum_snapshots.mastered_bits ELSE EXCLUDED.mastered_bits END,
      updated_at = now();

    UPDATE public.calc_curriculum_snapshots
    SET
      covered_bits = CASE WHEN COALESCE((item->>'covered')::boolean, false)
        THEN set_bit(covered_bits, target_index, 1) ELSE covered_bits END,
      within_target_bits = CASE WHEN COALESCE((item->>'within_target')::boolean, false)
        THEN set_bit(within_target_bits, target_index, 1) ELSE within_target_bits END,
      fluent_bits = set_bit(fluent_bits, target_index,
        CASE WHEN COALESCE((item->>'fluent')::boolean, false) THEN 1 ELSE 0 END),
      mastered_bits = set_bit(mastered_bits, target_index,
        CASE WHEN COALESCE((item->>'mastered')::boolean, false) THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE user_id = owner_id AND block_id = target_block;
  END LOOP;

  UPDATE public.calc_curriculum_snapshots AS snapshot
  SET
    covered_count = bit_count(snapshot.covered_bits)::integer,
    within_target_count = bit_count(snapshot.within_target_bits)::integer,
    fluent_count = bit_count(snapshot.fluent_bits)::integer,
    mastered_count = bit_count(snapshot.mastered_bits)::integer,
    updated_at = now()
  WHERE snapshot.user_id = owner_id
    AND snapshot.block_id IN (
      SELECT DISTINCT value->>'block_id' FROM jsonb_array_elements(p_items)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_calc_curriculum_snapshot(jsonb) TO authenticated;
