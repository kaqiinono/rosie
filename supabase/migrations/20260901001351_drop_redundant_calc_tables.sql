-- Destructive cutover after application and settlement RPC no longer reference these tables.
-- Intentionally no CASCADE: an unexpected dependency must stop the migration for review.

DO $$
DECLARE
  source_count bigint;
  archive_count bigint;
  prototype_count bigint;
BEGIN
  SELECT count(*) INTO source_count FROM public.calc_mistakes;
  SELECT count(*) INTO archive_count FROM archive.calc_mistakes_20260901;
  IF archive_count <> source_count THEN
    RAISE EXCEPTION 'calc_mistakes archive mismatch: source %, archive %',
      source_count, archive_count;
  END IF;

  SELECT
    (SELECT count(*) FROM public.calc_curriculum_completed) +
    (SELECT count(*) FROM public.calc_curriculum_history_audit) +
    (SELECT count(*) FROM public.calc_curriculum_progress)
  INTO prototype_count;
  IF prototype_count <> 0 THEN
    RAISE EXCEPTION 'prototype calc curriculum tables are no longer empty: % rows',
      prototype_count;
  END IF;
END;
$$;

DROP TABLE public.calc_curriculum_completed;
DROP TABLE public.calc_curriculum_history_audit;
DROP TABLE public.calc_curriculum_progress;
DROP TABLE public.calc_mistakes;
