-- Reject malformed or internally inconsistent settlement payloads before the
-- write-heavy implementation touches calc_problem_state. This keeps failed
-- requests from manufacturing dead tuples and WAL before a late validation
-- error rolls the transaction back.
CREATE OR REPLACE FUNCTION public.settle_calc_session(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
SET statement_timeout = '15s'
AS $$
DECLARE
  owner_id uuid := auth.uid();
  result jsonb;
  state_item jsonb;
  result_revision bigint;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(p_payload->'problem_states') <> 'array'
     OR jsonb_typeof(COALESCE(p_payload->'progress_items', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid calc settlement collections' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_payload->'problem_states') > 500
     OR jsonb_array_length(COALESCE(p_payload->'progress_items', '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'invalid calc settlement collections' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'problem_states') AS state(value)
    WHERE NULLIF(state.value->>'signature', '') IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'problem_states') AS state(value)
    GROUP BY state.value->>'signature'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'invalid or duplicate problem state transition' USING ERRCODE = '22023';
  END IF;

  -- Report projection validation previously happened after the base settlement.
  -- Validate it first so a bad projection cannot roll back already-written rows.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'problem_states') AS state(value)
    WHERE state.value ? 'report_facets_version'
      AND (COALESCE(state.value->>'report_facets_version', '') <> '1'
        OR jsonb_typeof(COALESCE(state.value->'report_structure_facets', '[]'::jsonb)) <> 'array')
  ) THEN
    RAISE EXCEPTION 'invalid calc report facets' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'problem_states') AS state(value)
    WHERE state.value ? 'report_facets_version'
      AND jsonb_array_length(COALESCE(state.value->'report_structure_facets', '[]'::jsonb)) > 20
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'problem_states') AS state(value)
    CROSS JOIN LATERAL unnest(ARRAY[
      'report_covered', 'report_within_target', 'report_fluent',
      'report_mastered', 'report_review_due', 'report_stable'
    ]) AS field(name)
    WHERE state.value ? 'report_facets_version'
      AND state.value ? field.name
      AND state.value->>field.name NOT IN ('true', 'false')
  ) THEN
    RAISE EXCEPTION 'invalid calc report projection values' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'progress_items', '[]'::jsonb)) AS item(value)
    WHERE NULLIF(item.value->>'block_id', '') IS NULL
      OR NULLIF(item.value->>'curriculum_version', '') IS NULL
      OR COALESCE(item.value->>'curriculum_index', '') !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'invalid calc progress mutation' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'progress_items', '[]'::jsonb)) AS item(value)
    GROUP BY
      item.value->>'block_id',
      item.value->>'curriculum_version',
      item.value->>'curriculum_index'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate calc progress mutation' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'progress_items', '[]'::jsonb)) AS item(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.calc_curriculum_registry AS registry
      WHERE registry.block_id = item.value->>'block_id'
        AND registry.curriculum_version = item.value->>'curriculum_version'
        AND registry.status = 'active'
        AND registry.coverage_kind = 'formula'
        AND (item.value->>'curriculum_index')::integer
          BETWEEN 0 AND registry.universe_size - 1
    )
  ) THEN
    RAISE EXCEPTION 'unknown or inactive calc curriculum item' USING ERRCODE = '22023';
  END IF;

  result := public.settle_calc_session_without_report_projection(p_payload);
  result_revision := (result->>'revision')::bigint;

  FOR state_item IN SELECT value FROM jsonb_array_elements(p_payload->'problem_states')
  LOOP
    IF state_item ? 'report_facets_version' THEN
      UPDATE public.calc_problem_state SET
        report_facets_version = (state_item->>'report_facets_version')::integer,
        report_concept_key = NULLIF(state_item->>'report_concept_key', ''),
        report_structure_facets = COALESCE(state_item->'report_structure_facets', '[]'::jsonb),
        report_rule_key = NULLIF(state_item->>'report_rule_key', ''),
        report_covered = COALESCE((state_item->>'report_covered')::boolean, false),
        report_within_target = COALESCE((state_item->>'report_within_target')::boolean, false),
        report_fluent = COALESCE((state_item->>'report_fluent')::boolean, false),
        report_mastered = COALESCE((state_item->>'report_mastered')::boolean, false),
        report_review_due = COALESCE((state_item->>'report_review_due')::boolean, false),
        report_stable = COALESCE((state_item->>'report_stable')::boolean, false)
      WHERE user_id = owner_id
        AND signature = state_item->>'signature'
        AND applied_revision = result_revision;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'calc report projection revision conflict' USING ERRCODE = '40001';
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_calc_session(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_calc_session(jsonb) TO authenticated;
