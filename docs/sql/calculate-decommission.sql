-- ============================================================================
-- Phase 6 — DECOMMISSION the legacy /calculate module's tables.
--
-- ⚠️  DO NOT RUN until Phase 6 of the calc-fusion plan.
--     (spec:  docs/superpowers/specs/2026-06-12-calc-calculate-fusion-design.md)
--
-- Prerequisites BEFORE running this:
--   1. Phases 2–5 complete — the rich question types (vertical, remainder,
--      decimals, fractions) and the error-diagnosis/report have been ported
--      into /calc, so /calculate is no longer needed.
--   2. The /calculate app code has been deleted in the same change:
--        - src/app/calculate/**
--        - src/utils/calculate-*.ts
--        - src/hooks/useCalculateSettings.ts, useCalculateLevelState.ts
--      Verify nothing references these tables anymore:
--        grep -rE "calculate_[a-z_]+" src     # must return nothing
--
-- These are the legacy module's own tables (calculate_ prefix). They are
-- SEPARATE from the active /calc module tables (calc_ prefix:
-- calc_settings, calc_problem_state, calc_sessions, calc_mistakes, …),
-- which this script does NOT touch.
--
-- This drop is destructive and irreversible. Take a backup / snapshot first.
-- ============================================================================

-- Tables confirmed in use by the /calculate module (as of Phase 1):
drop table if exists calculate_mistakes;
drop table if exists calculate_sessions;
drop table if exists calculate_level_state;
drop table if exists calculate_settings;

-- Possibly-orphan tables: defined by old types (CalculateTopicState /
-- CalculateEvent) but never referenced by app code. `if exists` makes these
-- safe whether or not they were ever created.
drop table if exists calculate_topic_state;
drop table if exists calculate_event_log;
