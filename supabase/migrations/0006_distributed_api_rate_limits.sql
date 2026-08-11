-- Distributed fixed-window API rate limiting for Vercel multi-instance deployments.
-- Only the service_role can execute the RPC; raw IP addresses are never stored.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash      text NOT NULL,
  route         text NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_hash, route, window_start)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_key_hash text,
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '2s'
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64
     OR p_route IS NULL OR length(p_route) > 160
     OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_rate_limit_input';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  -- Serialize only the same key+route. Different users/routes remain concurrent.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash || ':' || p_route, 0));

  DELETE FROM public.api_rate_limits
  WHERE key_hash = p_key_hash
    AND route = p_route
    AND window_start < v_window_start;

  INSERT INTO public.api_rate_limits (
    key_hash,
    route,
    window_start,
    request_count,
    updated_at
  )
  VALUES (p_key_hash, p_route, v_window_start, 1, clock_timestamp())
  ON CONFLICT (key_hash, route, window_start)
  DO UPDATE SET
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = clock_timestamp()
  RETURNING request_count INTO v_count;

  RETURN v_count > p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) TO service_role;
