-- Star wallet server-side aggregation (O(1) reads) + historical star_sessions
-- compaction, plus voucher price snapshots so "spent" is frozen at redemption
-- instead of being recomputed from CURRENT template prices (which would let a
-- template reprice retroactively change historical balances).
--
-- Background: star_sessions grows by one row per correct answer in english /
-- math quizzes. The client used to fetch ALL rows to compute balances; once a
-- user crossed PostgREST's 1000-row cap the balances silently froze (see the
-- 2026-08 "adding stars has no effect" bug).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Voucher price snapshot
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.calc_vouchers
  ADD COLUMN IF NOT EXISTS price_yellow integer,
  ADD COLUMN IF NOT EXISTS price_red    integer,
  ADD COLUMN IF NOT EXISTS price_blue   integer;

-- Backfill existing non-free vouchers with current template prices — this
-- preserves the client's previous recompute-from-current-price behaviour for
-- historical rows. Vouchers whose template no longer exists stay NULL and are
-- treated as zero cost (same as the client's `if (!p) continue` skip).
UPDATE public.calc_vouchers v
SET price_yellow = t.price_yellow,
    price_red    = t.price_red,
    price_blue   = t.price_blue
FROM public.voucher_templates t
WHERE v.category = t.category
  AND v.free IS NOT TRUE
  AND v.price_yellow IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Wallet balances RPC — replaces the client's fetch-all-rows computation.
--    SECURITY INVOKER: RLS still applies, so a caller only ever aggregates
--    their own rows.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.star_wallet_balances()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'earned', COALESCE((
      SELECT jsonb_object_agg(e.source, e.total)
      FROM (
        SELECT source, COALESCE(SUM(coins_earned), 0)::int AS total
        FROM public.star_sessions
        GROUP BY source
      ) e
    ), '{}'::jsonb),
    'spent', (
      SELECT jsonb_build_object(
        'yellow', COALESCE(SUM(COALESCE(price_yellow, 0)), 0)::int,
        'red',    COALESCE(SUM(COALESCE(price_red, 0)), 0)::int,
        'blue',   COALESCE(SUM(COALESCE(price_blue, 0)), 0)::int
      )
      FROM public.calc_vouchers
      WHERE free IS NOT TRUE
    ),
    'calcCoinsByDate', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(d.date, d.total))
      FROM (
        SELECT date, SUM(coins_earned)::int AS total
        FROM public.star_sessions
        WHERE source = 'calc' AND date IS NOT NULL
        GROUP BY date
      ) d
    ), '[]'::jsonb),
    'coinsBySessionId', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(r.ref_id, r.total))
      FROM (
        SELECT ref_id, SUM(coins_earned)::int AS total
        FROM public.star_sessions
        WHERE ref_id IS NOT NULL
        GROUP BY ref_id
      ) r
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.star_wallet_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.star_wallet_balances() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Compaction RPC — merges old per-question star rows into one row per
--    (user_id, date, source). Totals are preserved exactly.
--      * Only rows older than the cooldown (default 7 days) are touched, so
--        the awards page's "today log" and the recent error-correction window
--        stay intact.
--      * Rows carrying ref_id are NEVER merged: they are the one-per-session
--        calc rows the wallet joins to session details by ref_id.
--      * Atomic: insert + delete share one statement snapshot, so the delete
--        cannot see (or remove) the just-inserted aggregate rows.
--      * Idempotent: merged groups become single rows and are skipped on rerun.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compact_star_sessions(cooldown_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_deleted integer;
BEGIN
  -- Service-role-only: this aggregates and deletes rows across all users.
  v_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)
  );
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'compact_star_sessions requires the service role';
  END IF;

  WITH agg AS (
    SELECT s.user_id, s.date, s.source,
           SUM(s.coins_earned)::int AS total,
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

-- No grant to anon/authenticated: only the service role (via the admin API
-- route or pg_cron as postgres, which owns the tables) may execute it.
REVOKE ALL ON FUNCTION public.compact_star_sessions(integer) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Nightly schedule (best-effort; skipped if pg_cron is unavailable).
--    17:30 UTC ≈ 01:30 Asia/Shanghai.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'compact_star_sessions') THEN
    PERFORM cron.schedule(
      'compact_star_sessions',
      '30 17 * * *',
      $cron$SELECT public.compact_star_sessions(7)$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$$;
