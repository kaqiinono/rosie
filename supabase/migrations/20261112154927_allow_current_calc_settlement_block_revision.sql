-- The user's locked runtime row reserves next_revision for this settlement.
-- A new block and subsequent questions in the same block already carry it.
DO $migration$
DECLARE
  definition text := pg_get_functiondef(
    'public.settle_calc_session_without_report_projection(jsonb)'::regprocedure
  );
  old_guard constant text := 'AND applied_revision <= expected_revision;';
  new_guard constant text := 'AND applied_revision <= next_revision;';
BEGIN
  IF array_length(string_to_array(definition, old_guard), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'unexpected calc block progress revision guard';
  END IF;
  EXECUTE replace(definition, old_guard, new_guard);
END;
$migration$;
