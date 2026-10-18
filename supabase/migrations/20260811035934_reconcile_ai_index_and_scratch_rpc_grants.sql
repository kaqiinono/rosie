SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP INDEX IF EXISTS public.uq_ai_teaching_sessions_active_conversation_subject;

REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb)
  TO authenticated, service_role;
