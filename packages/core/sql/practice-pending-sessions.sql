-- Mid-session practice resume (cross-device).
-- Run in Supabase SQL editor. Idempotent. No destructive data ops.

CREATE TABLE IF NOT EXISTS public.practice_pending_sessions (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  stash JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, scope_key),
  CONSTRAINT practice_pending_sessions_kind_chk
    CHECK (kind IN ('calc', 'chinese', 'math', 'english_adaptive', 'english_weekly'))
);

CREATE INDEX IF NOT EXISTS idx_practice_pending_user
  ON public.practice_pending_sessions (user_id);

ALTER TABLE public.practice_pending_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS practice_pending_sessions_own ON public.practice_pending_sessions;
CREATE POLICY practice_pending_sessions_own ON public.practice_pending_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
