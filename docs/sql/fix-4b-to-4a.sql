-- =========================================================================
-- Corrective migration: relabel mislabelled stage '4B' rows as '4A'
--
-- The Units 7–12 vocabulary was loaded as stage '4B' by mistake; those words
-- actually belong to stage '4A' (which already holds Units 1–6, so '4A' now
-- spans Units 1–12). Stage is NOT part of the word identity used for mastery
-- (that key is unit::lesson::word), so this relabel does not affect any
-- existing progress/mastery records.
--
-- HOW TO USE
--   1. Supabase Dashboard → SQL Editor → New query → paste → Run.
--   2. Expected: 223 rows updated.
--   3. Verify afterwards:
--        SELECT stage, COUNT(*) FROM word_entries GROUP BY stage ORDER BY stage;
--        -- should show only '4A' (no '4B')
--
-- SAFE: all '4B' rows are Units 7–12 with no '4A' overlap, so a plain relabel
-- cannot collide with existing Units 1–6 rows.
-- =========================================================================

BEGIN;

UPDATE word_entries SET stage = '4A' WHERE stage = '4B';

-- Sanity check inside the transaction (should return 0):
-- SELECT COUNT(*) FROM word_entries WHERE stage = '4B';

COMMIT;
