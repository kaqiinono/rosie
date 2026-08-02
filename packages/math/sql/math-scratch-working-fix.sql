-- Minimal fix for 42501 on math_scratch_working writes.
-- Run THIS file alone in Supabase SQL Editor (do not batch with other scripts).
-- Idempotent. No data wipe.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.math_scratch_working (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  paper_scope TEXT NOT NULL DEFAULT '',
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_draft JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id, paper_scope)
);

-- If an older table exists without PK, try to add the conflict target.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.math_scratch_working'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.math_scratch_working
      ADD CONSTRAINT math_scratch_working_pkey
      PRIMARY KEY (user_id, problem_id, paper_scope);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Could not add PK on math_scratch_working: %', SQLERRM;
END $$;

ALTER TABLE public.math_scratch_working ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy (names vary across environments).
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

-- Type-safe compare (uuid column or text column).
CREATE POLICY math_scratch_working_select ON public.math_scratch_working
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY math_scratch_working_insert ON public.math_scratch_working
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY math_scratch_working_update ON public.math_scratch_working
  FOR UPDATE USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY math_scratch_working_delete ON public.math_scratch_working
  FOR DELETE USING (auth.uid()::text = user_id::text);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_working TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_scratch_working TO service_role;

-- RPC: write as auth.uid(), bypasses flaky upsert RLS paths.
CREATE OR REPLACE FUNCTION public.upsert_math_scratch_working(
  p_problem_id text,
  p_paper_scope text,
  p_objects jsonb,
  p_answer_draft jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.math_scratch_working AS w (
    user_id, problem_id, paper_scope, objects, answer_draft, updated_at
  ) VALUES (
    uid,
    p_problem_id,
    COALESCE(p_paper_scope, ''),
    COALESCE(p_objects, '[]'::jsonb),
    p_answer_draft,
    NOW()
  )
  ON CONFLICT (user_id, problem_id, paper_scope)
  DO UPDATE SET
    objects = EXCLUDED.objects,
    answer_draft = EXCLUDED.answer_draft,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
