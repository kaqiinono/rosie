-- Additive foundation for unified calc settlement and scalable progress.
--
-- This migration deliberately does not remove or lock down any legacy write
-- path. New tables are read-only to authenticated clients until the settlement
-- RPC is introduced in a later, independently reversible migration.
--
-- Production already contains the forward migration 20260828102247 with
-- calc_curriculum_progress (selection pointer / assessment runtime),
-- calc_curriculum_completed (per-formula coverage prototype), and
-- calc_curriculum_history_audit. Their semantics and lifecycle differ from
-- calc_block_progress, so this migration deliberately leaves all three intact.

CREATE TABLE public.calc_curriculum_registry (
  block_id text NOT NULL,
  curriculum_version text NOT NULL,
  universe_size integer NOT NULL CHECK (universe_size BETWEEN 1 AND 200000),
  curriculum_hash text NOT NULL CHECK (curriculum_hash ~ '^[0-9a-f]{64}$'),
  coverage_kind text NOT NULL CHECK (coverage_kind IN ('formula', 'structure')),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (block_id, curriculum_version),
  UNIQUE (block_id, curriculum_hash),
  CONSTRAINT calc_curriculum_registry_lifecycle_check CHECK (
    (status = 'draft' AND activated_at IS NULL AND retired_at IS NULL)
    OR (status = 'active' AND activated_at IS NOT NULL AND retired_at IS NULL)
    OR (status = 'retired' AND activated_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX calc_curriculum_registry_one_active_per_block_idx
  ON public.calc_curriculum_registry (block_id)
  WHERE status = 'active';

ALTER TABLE public.calc_curriculum_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY calc_curriculum_registry_authenticated_read
  ON public.calc_curriculum_registry
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.calc_curriculum_registry TO authenticated;

CREATE TABLE public.calc_user_runtime (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state_revision bigint NOT NULL DEFAULT 0 CHECK (state_revision >= 0),
  last_session_no bigint NOT NULL DEFAULT 0 CHECK (last_session_no >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calc_user_runtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY calc_user_runtime_select_own
  ON public.calc_user_runtime
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.calc_user_runtime TO authenticated;

ALTER TABLE public.calc_problem_state
  ADD COLUMN needs_remediation boolean NOT NULL DEFAULT false,
  ADD COLUMN last_wrong_at timestamptz,
  ADD COLUMN last_wrong_session_no bigint,
  ADD COLUMN last_error_tag text,
  ADD COLUMN last_user_answer text,
  ADD COLUMN last_answer_json jsonb,
  ADD COLUMN remediation_correct_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN applied_revision bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT calc_problem_state_remediation_correct_count_check
    CHECK (remediation_correct_count BETWEEN 0 AND 3),
  ADD CONSTRAINT calc_problem_state_applied_revision_check
    CHECK (applied_revision >= 0),
  ADD CONSTRAINT calc_problem_state_wrong_session_check
    CHECK (last_wrong_session_no IS NULL OR last_wrong_session_no >= 0);

CREATE INDEX calc_problem_state_user_remediation_idx
  ON public.calc_problem_state (user_id, last_wrong_at DESC, signature)
  WHERE needs_remediation;

-- Idempotent compatibility backfill. A legacy mistake can exist without a
-- problem-state row, so create the narrow projection first, then copy the
-- latest remediation summary. Detailed history remains in question_log.
INSERT INTO public.calc_problem_state (
  user_id,
  signature,
  level,
  block_id,
  proficiency,
  attempt_count,
  appearance_count,
  recent_results,
  status,
  consecutive_wrong,
  consecutive_correct,
  updated_at
)
SELECT
  mistake.user_id,
  mistake.signature,
  CASE WHEN mistake.level ~ '^[0-9]+$' THEN mistake.level::smallint ELSE 99 END,
  NULL,
  0,
  0,
  0,
  '[]'::jsonb,
  'active',
  0,
  0,
  mistake.last_wrong_at
FROM public.calc_mistakes AS mistake
ON CONFLICT (user_id, signature) DO NOTHING;

UPDATE public.calc_problem_state AS state
SET
  needs_remediation = NOT mistake.resolved,
  last_wrong_at = mistake.last_wrong_at,
  last_wrong_session_no = mistake.session_no,
  last_error_tag = mistake.error_tag,
  last_user_answer = mistake.user_answer,
  last_answer_json = COALESCE(mistake.answer_json, jsonb_build_object('kind', 'int', 'value', mistake.answer)),
  remediation_correct_count = LEAST(3, GREATEST(0, mistake.consecutive_correct))::smallint
FROM public.calc_mistakes AS mistake
WHERE state.user_id = mistake.user_id
  AND state.signature = mistake.signature;

ALTER TABLE public.calc_sessions
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN session_no bigint,
  ADD COLUMN state_revision bigint,
  ADD COLUMN client_schema_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT calc_sessions_session_no_check CHECK (session_no IS NULL OR session_no > 0),
  ADD CONSTRAINT calc_sessions_state_revision_check
    CHECK (state_revision IS NULL OR state_revision > 0),
  ADD CONSTRAINT calc_sessions_client_schema_version_check
    CHECK (client_schema_version BETWEEN 1 AND 1000);

CREATE UNIQUE INDEX calc_sessions_user_idempotency_key_idx
  ON public.calc_sessions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX calc_sessions_user_session_no_idx
  ON public.calc_sessions (user_id, session_no)
  WHERE session_no IS NOT NULL;

CREATE TABLE public.calc_block_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  curriculum_version text NOT NULL,
  universe_size integer NOT NULL CHECK (universe_size BETWEEN 1 AND 200000),
  coverage_kind text NOT NULL CHECK (coverage_kind IN ('formula', 'structure')),
  formula_covered_bits bytea,
  formula_within_target_bits bytea,
  formula_fluent_bits bytea,
  formula_mastered_bits bytea,
  structure_covered_bits bytea,
  structure_fluent_bits bytea,
  structure_mastered_bits bytea,
  covered_count integer NOT NULL DEFAULT 0,
  within_target_count integer NOT NULL DEFAULT 0,
  fluent_count integer NOT NULL DEFAULT 0,
  mastered_count integer NOT NULL DEFAULT 0,
  review_due_count integer NOT NULL DEFAULT 0,
  recent_independent_correct integer NOT NULL DEFAULT 0,
  recent_independent_total integer NOT NULL DEFAULT 0,
  stable_count integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'initial'
    CHECK (tier IN ('initial', 'stabilized', 'graduated')),
  ready boolean NOT NULL DEFAULT false,
  recovery boolean NOT NULL DEFAULT false,
  applied_revision bigint NOT NULL DEFAULT 0 CHECK (applied_revision >= 0),
  health_status text NOT NULL DEFAULT 'rebuild_required'
    CHECK (health_status IN ('healthy', 'stale', 'rebuild_required', 'version_conflict')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, block_id, curriculum_version),
  FOREIGN KEY (block_id, curriculum_version)
    REFERENCES public.calc_curriculum_registry (block_id, curriculum_version),
  CONSTRAINT calc_block_progress_counts_fit CHECK (
    covered_count BETWEEN 0 AND universe_size
    AND within_target_count BETWEEN 0 AND universe_size
    AND fluent_count BETWEEN 0 AND universe_size
    AND mastered_count BETWEEN 0 AND universe_size
    AND review_due_count BETWEEN 0 AND universe_size
    AND recent_independent_correct >= 0
    AND recent_independent_total >= recent_independent_correct
    AND stable_count BETWEEN 0 AND universe_size
  ),
  CONSTRAINT calc_block_progress_bitmap_shape_check CHECK (
    (
      coverage_kind = 'formula'
      AND formula_covered_bits IS NOT NULL
      AND formula_within_target_bits IS NOT NULL
      AND formula_fluent_bits IS NOT NULL
      AND formula_mastered_bits IS NOT NULL
      AND structure_covered_bits IS NULL
      AND structure_fluent_bits IS NULL
      AND structure_mastered_bits IS NULL
      AND octet_length(formula_covered_bits) = (universe_size + 7) / 8
      AND octet_length(formula_within_target_bits) = (universe_size + 7) / 8
      AND octet_length(formula_fluent_bits) = (universe_size + 7) / 8
      AND octet_length(formula_mastered_bits) = (universe_size + 7) / 8
    ) OR (
      coverage_kind = 'structure'
      AND formula_covered_bits IS NULL
      AND formula_within_target_bits IS NULL
      AND formula_fluent_bits IS NULL
      AND formula_mastered_bits IS NULL
      AND structure_covered_bits IS NOT NULL
      AND structure_fluent_bits IS NOT NULL
      AND structure_mastered_bits IS NOT NULL
      AND octet_length(structure_covered_bits) = (universe_size + 7) / 8
      AND octet_length(structure_fluent_bits) = (universe_size + 7) / 8
      AND octet_length(structure_mastered_bits) = (universe_size + 7) / 8
    )
  ),
  CONSTRAINT calc_block_progress_bit_counts_fit CHECK (
    covered_count = bit_count(
      CASE WHEN coverage_kind = 'formula' THEN formula_covered_bits ELSE structure_covered_bits END
    )
    AND fluent_count = bit_count(
      CASE WHEN coverage_kind = 'formula' THEN formula_fluent_bits ELSE structure_fluent_bits END
    )
    AND mastered_count = bit_count(
      CASE WHEN coverage_kind = 'formula' THEN formula_mastered_bits ELSE structure_mastered_bits END
    )
    AND (
      coverage_kind = 'structure'
      OR within_target_count = bit_count(formula_within_target_bits)
    )
  )
);

CREATE INDEX calc_block_progress_user_health_idx
  ON public.calc_block_progress (user_id, health_status, updated_at DESC);

CREATE INDEX calc_block_progress_registry_fk_idx
  ON public.calc_block_progress (block_id, curriculum_version);

ALTER TABLE public.calc_block_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY calc_block_progress_select_own
  ON public.calc_block_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.calc_block_progress TO authenticated;

-- The reward idempotency index is intentionally deferred until a production
-- duplicate audit has run. Its reviewed target shape is:
--   (user_id, source, ref_id) WHERE ref_id IS NOT NULL
-- Creating it speculatively could make this otherwise-additive migration fail.
