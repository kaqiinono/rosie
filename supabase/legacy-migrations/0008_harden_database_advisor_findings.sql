-- Resolve the high-confidence security findings from Supabase Database Advisors.
-- Keep lock waits short so a busy production database fails safely instead of
-- recreating the DDL deadlock previously seen while applying policy changes.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Internal migration history is used only by the direct Postgres migration
-- runner. It must not be exposed through the Data API.
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC, anon, authenticated, service_role;

-- Notes remain readable by every authenticated learner, but only their owner
-- (or an administrator) may mutate them.
DROP POLICY IF EXISTS math_problem_notes_insert ON public.math_problem_notes;
CREATE POLICY math_problem_notes_insert ON public.math_problem_notes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS math_problem_notes_update ON public.math_problem_notes;
CREATE POLICY math_problem_notes_update ON public.math_problem_notes
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS math_problem_notes_delete ON public.math_problem_notes;
CREATE POLICY math_problem_notes_delete ON public.math_problem_notes
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Pin function lookup paths and schema-qualify referenced objects. The RPC is
-- authenticated-only; trigger functions are not directly callable APIs.
CREATE OR REPLACE FUNCTION public.increment_math_solved(
  p_user_id uuid,
  p_prob_id text
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.math_solved (user_id, problem_id, solve_count, solved_at)
  VALUES (p_user_id, p_prob_id, 1, pg_catalog.now())
  ON CONFLICT (user_id, problem_id)
  DO UPDATE SET
    solve_count = public.math_solved.solve_count + 1,
    solved_at = pg_catalog.now()
  RETURNING solve_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_math_solved(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_math_solved(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.knowledge_chunks_update_content_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.subject = 'english' THEN
    NEW.content_tsv := pg_catalog.to_tsvector(
      'pg_catalog.english'::pg_catalog.regconfig,
      NEW.content
    );
  ELSE
    NEW.content_tsv := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.knowledge_chunks_update_content_tsv() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.math_wrong_clear_resolved_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.resolved := false;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.math_wrong_clear_resolved_on_insert() FROM PUBLIC, anon, authenticated, service_role;
