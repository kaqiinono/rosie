-- Reduce write amplification on the two bounded calc-session lookup indexes.
--
-- The previous indexes included needs_remediation and updated_at. Both values
-- change during normal settlement, so every problem-state update had to write
-- two large secondary indexes. The prepare RPC still gets a selective lookup
-- from the stable owner/source prefix and sorts the small per-user candidate
-- set in memory.
DROP INDEX IF EXISTS public.calc_problem_state_user_block_priority_idx;
CREATE INDEX calc_problem_state_user_block_priority_idx
  ON public.calc_problem_state (user_id, block_id)
  WHERE block_id IS NOT NULL;

DROP INDEX IF EXISTS public.calc_problem_state_user_mixed_priority_idx;
CREATE INDEX calc_problem_state_user_mixed_priority_idx
  ON public.calc_problem_state (user_id, mixed_op_id)
  WHERE mixed_op_id IS NOT NULL;

-- Hybrid vector/text search performs several small rank/merge sorts. The
-- project default is 4 MB and the query was spilling on every observed call.
-- Keep the override scoped to this function rather than raising work_mem for
-- every database connection.
ALTER FUNCTION public.search_knowledge(
  vector(1536), text, text, smallint, jsonb, integer, double precision, integer
) SET work_mem = '8MB';

-- pg_cron connects as postgres and has no request JWT. The previous JWT-only
-- check therefore rejected every scheduled run. Keep browser roles revoked,
-- allow the postgres scheduler explicitly, and retain the service-role path
-- used by the admin API.
CREATE OR REPLACE FUNCTION public.compact_star_sessions(cooldown_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_deleted integer;
BEGIN
  v_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)
  );
  IF session_user <> 'postgres' AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'compact_star_sessions requires the service role';
  END IF;

  WITH agg AS (
    SELECT s.user_id, s.date, s.source,
           SUM(s.coins_earned)::integer AS total,
           MIN(s.created_at) AS first_created
    FROM public.star_sessions s
    WHERE s.created_at < now() - make_interval(days => GREATEST(cooldown_days, 1))
      AND s.ref_id IS NULL
    GROUP BY s.user_id, s.date, s.source
    HAVING COUNT(*) > 1
  ),
  ins AS (
    INSERT INTO public.star_sessions (user_id, date, source, coins_earned, created_at)
    SELECT user_id, date, source, total, first_created
    FROM agg
  ),
  del AS (
    DELETE FROM public.star_sessions s
    USING agg
    WHERE s.user_id = agg.user_id
      AND s.date = agg.date
      AND s.source = agg.source
      AND s.ref_id IS NULL
      AND s.created_at < now() - make_interval(days => GREATEST(cooldown_days, 1))
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.compact_star_sessions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compact_star_sessions(integer) TO service_role;
