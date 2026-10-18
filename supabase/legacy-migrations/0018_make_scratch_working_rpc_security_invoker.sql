-- The function writes only auth.uid()-owned rows and the target table already
-- has matching RLS plus authenticated DML grants, so elevated execution is not required.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb)
  SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_math_scratch_working(text, text, jsonb, jsonb)
  TO authenticated, service_role;
