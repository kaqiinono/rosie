-- Teaching state is user-owned and exposed only to authenticated clients.
-- This migration was originally applied out of band and later normalized to
-- the Rosie NNNN migration sequence.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.ai_teaching_sessions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid,
  subject         text NOT NULL CHECK (subject IN ('english', 'math', 'chinese')),
  content_ref     text,
  teaching_stage  text NOT NULL DEFAULT 'understand' CHECK (
    teaching_stage IN ('understand', 'attempt', 'hint', 'check', 'transfer', 'summary')
  ),
  hint_level      smallint NOT NULL DEFAULT 0 CHECK (hint_level BETWEEN 0 AND 3),
  attempt_count   smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  latest_answer   text,
  error_kind      text,
  state           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'abandoned')
  ),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS ai_teaching_sessions_user_status_idx
  ON public.ai_teaching_sessions (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_teaching_sessions_conversation_idx
  ON public.ai_teaching_sessions (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.ai_teaching_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_teaching_sessions_select_own ON public.ai_teaching_sessions;
CREATE POLICY ai_teaching_sessions_select_own ON public.ai_teaching_sessions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ai_teaching_sessions_insert_own ON public.ai_teaching_sessions;
CREATE POLICY ai_teaching_sessions_insert_own ON public.ai_teaching_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ai_teaching_sessions_update_own ON public.ai_teaching_sessions;
CREATE POLICY ai_teaching_sessions_update_own ON public.ai_teaching_sessions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ai_teaching_sessions_delete_own ON public.ai_teaching_sessions;
CREATE POLICY ai_teaching_sessions_delete_own ON public.ai_teaching_sessions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.ai_teaching_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_teaching_sessions TO authenticated;
