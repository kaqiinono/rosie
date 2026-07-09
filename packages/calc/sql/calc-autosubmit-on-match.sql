-- Calc auto-submit on match: auto_submit_on_match on calc_settings.
-- Incremental only — no DELETE / TRUNCATE / reseed.
-- Run in Supabase SQL editor once. Idempotent.
-- Mirror: docs/sql/calc-autosubmit-on-match.sql (docs/ is gitignored).

ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS auto_submit_on_match boolean NOT NULL DEFAULT true;
