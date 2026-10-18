-- Reconcile an out-of-band duplicate teaching-session index and restore the
-- intended least-privilege grants for the scratch-working RPC.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP INDEX IF EXISTS public.uq_ai_teaching_sessions_active_conversation_subject;

CREATE UNIQUE INDEX IF NOT EXISTS ai_teaching_sessions_one_active_conversation_idx
  ON public.ai_teaching_sessions (user_id, conversation_id, subject)
  WHERE status = 'active' AND conversation_id IS NOT NULL;

REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb)
  TO authenticated, service_role;
