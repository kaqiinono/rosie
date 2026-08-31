-- Keep bitmap-derived counters synchronized before immediate CHECK constraints run.
CREATE OR REPLACE FUNCTION public.sync_calc_block_progress_counts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.covered_count := bit_count(NEW.formula_covered_bits)::integer;
  NEW.within_target_count := bit_count(NEW.formula_within_target_bits)::integer;
  NEW.fluent_count := bit_count(NEW.formula_fluent_bits)::integer;
  NEW.mastered_count := bit_count(NEW.formula_mastered_bits)::integer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_calc_block_progress_counts
  ON public.calc_block_progress;

CREATE TRIGGER sync_calc_block_progress_counts
BEFORE INSERT OR UPDATE OF
  formula_covered_bits,
  formula_within_target_bits,
  formula_fluent_bits,
  formula_mastered_bits
ON public.calc_block_progress
FOR EACH ROW
EXECUTE FUNCTION public.sync_calc_block_progress_counts();

REVOKE ALL ON FUNCTION public.sync_calc_block_progress_counts() FROM PUBLIC;
