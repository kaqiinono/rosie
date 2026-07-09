-- Calc session timing modes: default timing_mode + bonus_sec on calc_settings.
-- Incremental only — no DELETE / TRUNCATE / reseed.
-- Run in Supabase SQL editor once. Idempotent.
-- Mirror: docs/sql/calc-session-timing-modes.sql (docs/ is gitignored).

ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS timing_mode text NOT NULL DEFAULT 'relaxed';

ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS bonus_sec integer NOT NULL DEFAULT 3;
