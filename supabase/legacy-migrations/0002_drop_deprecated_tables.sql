-- 0002_drop_deprecated_tables.sql
-- Drop 4 deprecated tables with zero code references (confirmed via code grep,
-- row counts, and inbound-FK / view-dependency checks on 2026-08-05):
--   calc_event_log   (0 rows)   — dead calc feature
--   robot_tasks      (0 rows)   — orphaned; matches the empty `robot` package
--   calc_level_state (5 rows)   — dead calc feature
--   vocabulary       (221 rows) — legacy pre-DB-only table, superseded by word_entries
--
-- Data was backed up first to supabase/backups/2026-08-05-deprecated-tables.sql
-- (schema + COPY data). To restore, run that file against the database.
-- No inbound foreign keys or view/function dependencies exist, so plain DROP is safe.

DROP TABLE IF EXISTS public.calc_event_log;
DROP TABLE IF EXISTS public.robot_tasks;
DROP TABLE IF EXISTS public.calc_level_state;
DROP TABLE IF EXISTS public.vocabulary;
