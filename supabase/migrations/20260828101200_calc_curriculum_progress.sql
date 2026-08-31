-- Exact indexed curriculum progress. The universe remains code-defined; only practiced facts persist.

ALTER TABLE public.calc_problem_state
  DROP CONSTRAINT IF EXISTS calc_problem_state_status_check;

ALTER TABLE public.calc_problem_state
  ADD CONSTRAINT calc_problem_state_status_check
  CHECK (status = ANY (ARRAY['active', 'lagging', 'review', 'mastered', 'forced']));

CREATE TABLE public.calc_curriculum_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  curriculum_version integer NOT NULL CHECK (curriculum_version > 0),
  pointer_index integer NOT NULL DEFAULT 0 CHECK (pointer_index >= 0),
  stage_id text,
  assessment_round smallint NOT NULL DEFAULT 0 CHECK (assessment_round >= 0),
  consecutive_auto_rounds smallint NOT NULL DEFAULT 0 CHECK (consecutive_auto_rounds BETWEEN 0 AND 2),
  assessment jsonb NOT NULL DEFAULT '{"signatures":[],"correct":0,"total":0,"time_ms":0}'::jsonb,
  graduated_at timestamptz,
  graduation_summary jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, block_id)
);

CREATE TABLE public.calc_curriculum_completed (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  curriculum_version integer NOT NULL CHECK (curriculum_version > 0),
  curriculum_index integer NOT NULL CHECK (curriculum_index >= 0),
  coverage_signature text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'history')),
  PRIMARY KEY (user_id, block_id, curriculum_version, curriculum_index),
  UNIQUE (user_id, block_id, curriculum_version, coverage_signature)
);

CREATE TABLE public.calc_curriculum_history_audit (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum_version integer NOT NULL CHECK (curriculum_version > 0),
  tagged_count integer NOT NULL DEFAULT 0 CHECK (tagged_count >= 0),
  legacy_excluded_count integer NOT NULL DEFAULT 0 CHECK (legacy_excluded_count >= 0),
  unsupported_count integer NOT NULL DEFAULT 0 CHECK (unsupported_count >= 0),
  rebuilt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, curriculum_version)
);

CREATE INDEX calc_curriculum_completed_user_block_idx
  ON public.calc_curriculum_completed (user_id, block_id, curriculum_version, curriculum_index);

ALTER TABLE public.calc_curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calc_curriculum_completed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calc_curriculum_history_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY calc_curriculum_progress_own
  ON public.calc_curriculum_progress
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY calc_curriculum_completed_own
  ON public.calc_curriculum_completed
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY calc_curriculum_history_audit_own
  ON public.calc_curriculum_history_audit
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calc_curriculum_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calc_curriculum_completed TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calc_curriculum_history_audit TO authenticated;
