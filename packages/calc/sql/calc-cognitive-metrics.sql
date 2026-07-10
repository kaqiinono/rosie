-- Calc cognitive metrics (P0): consecutive_correct + recall index.
-- Incremental only — no DELETE / TRUNCATE / reseed.
-- Run in Supabase SQL editor. Idempotent.
-- Mirror: docs/sql/calc-cognitive-metrics.sql (docs/ is gitignored).

ALTER TABLE calc_problem_state
  ADD COLUMN IF NOT EXISTS consecutive_correct integer NOT NULL DEFAULT 0;

ALTER TABLE calc_problem_state
  ADD COLUMN IF NOT EXISTS last_within_limit boolean;

-- Speeds mastered recall: ORDER BY updated_at / score with LIMIT (see buildSession recall).
CREATE INDEX IF NOT EXISTS calc_problem_state_user_mastered_block_upd
  ON calc_problem_state (user_id, status, block_id, updated_at DESC)
  WHERE status = 'mastered';
