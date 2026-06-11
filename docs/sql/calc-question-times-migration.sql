-- Calc timing analysis: persist per-question first-attempt solve times.
-- Run manually in the Supabase SQL editor.
--
-- ⚠️ Run this BEFORE deploying the matching client change. The client now
-- includes `question_times_ms` in every calc_sessions INSERT; without this
-- column those inserts (and therefore star awards) would fail.

alter table public.calc_sessions
  add column if not exists question_times_ms jsonb not null default '[]'::jsonb;

-- Existing rows keep the default empty array; the results page falls back to
-- (time_spent_sec / count) for sessions recorded before this column existed.
