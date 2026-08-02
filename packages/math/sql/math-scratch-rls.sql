-- Fix / create math scratch tables + RLS for client upsert.
-- Run in Supabase SQL Editor (entire script). Idempotent. No data wipe.
--
-- Symptom: 42501
--   new row violates row-level security policy for table "math_scratch_working"
--
-- After running: refresh the app (or re-login if session is stale).

-- ── 1) Working canvas (autosave) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.math_scratch_working (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  paper_scope TEXT NOT NULL DEFAULT '',
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_draft JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id, paper_scope)
);

ALTER TABLE public.math_scratch_working ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'math_scratch_working'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.math_scratch_working', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY math_scratch_working_select ON public.math_scratch_working
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY math_scratch_working_insert ON public.math_scratch_working
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_scratch_working_update ON public.math_scratch_working
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_scratch_working_delete ON public.math_scratch_working
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_working TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_working TO service_role;

-- ── 2) Archived drafts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.math_scratch_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  object_count INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_math_scratch_drafts_user_problem
  ON public.math_scratch_drafts (user_id, problem_id);

ALTER TABLE public.math_scratch_drafts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'math_scratch_drafts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.math_scratch_drafts', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY math_scratch_drafts_select ON public.math_scratch_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY math_scratch_drafts_insert ON public.math_scratch_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_scratch_drafts_update ON public.math_scratch_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_scratch_drafts_delete ON public.math_scratch_drafts
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_drafts TO service_role;

-- ── 3) Practice attempts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.math_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  paper_id TEXT,
  correct BOOLEAN NOT NULL DEFAULT false,
  draft_id UUID REFERENCES public.math_scratch_drafts (id) ON DELETE SET NULL,
  answer_snapshot JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_math_practice_attempts_user_problem
  ON public.math_practice_attempts (user_id, problem_id, attempted_at DESC);

ALTER TABLE public.math_practice_attempts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'math_practice_attempts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.math_practice_attempts', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY math_practice_attempts_select ON public.math_practice_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY math_practice_attempts_insert ON public.math_practice_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_practice_attempts_update ON public.math_practice_attempts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY math_practice_attempts_delete ON public.math_practice_attempts
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_practice_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_practice_attempts TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verify (optional): should list 4 policies for math_scratch_working
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'math_scratch_working' ORDER BY policyname;
