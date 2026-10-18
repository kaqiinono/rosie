-- A business revision conflict must not use SQLSTATE 40001. PostgREST can
-- retry that code inside one request indefinitely, even after the client has
-- disconnected. PT409 returns an ordinary HTTP 409 to the caller instead.
--
-- A block's applied_revision is the last settlement that touched that block,
-- not the user's global revision. An older block is valid as long as it has
-- not been updated after expected_revision. The locked calc_user_runtime row
-- serializes settlements for this user.
--
-- Redefine the existing functions from their installed definitions so this
-- migration changes only the guarded predicate and error codes. Abort if an
-- installed function has drifted from the expected version.
DO $migration$
DECLARE
  base_function constant regprocedure :=
    'public.settle_calc_session_without_report_projection(jsonb)'::regprocedure;
  wrapper_function constant regprocedure :=
    'public.settle_calc_session(jsonb)'::regprocedure;
  prepare_function constant regprocedure :=
    'public.prepare_calc_session(jsonb)'::regprocedure;
  function_id regprocedure;
  definition text;
  old_error constant text := 'ERRCODE = ''40001''';
  old_predicate constant text :=
    'AND applied_revision IN (expected_revision, next_revision)';
  expected_error_count integer;
  actual_error_count integer;
  predicate_count integer;
BEGIN
  FOREACH function_id IN ARRAY ARRAY[base_function, wrapper_function, prepare_function]
  LOOP
    definition := pg_get_functiondef(function_id);
    expected_error_count := CASE function_id
      WHEN base_function THEN 4
      ELSE 1
    END;
    actual_error_count :=
      (length(definition) - length(replace(definition, old_error, '')))
      / length(old_error);
    IF actual_error_count <> expected_error_count THEN
      RAISE EXCEPTION 'unexpected calc function definition: % has % business 40001 errors, expected %',
        function_id, actual_error_count, expected_error_count;
    END IF;

    IF function_id = base_function THEN
      predicate_count :=
        (length(definition) - length(replace(definition, old_predicate, '')))
        / length(old_predicate);
      IF predicate_count <> 1 THEN
        RAISE EXCEPTION 'unexpected calc block revision predicate: %', function_id;
      END IF;
      definition := replace(
        definition,
        old_predicate,
        'AND applied_revision <= expected_revision'
      );
    ELSIF function_id = wrapper_function THEN
      IF position(
        'public.settle_calc_session_without_report_projection(p_payload)'
        IN definition
      ) = 0 THEN
        RAISE EXCEPTION 'unexpected calc settlement wrapper: %', function_id;
      END IF;
    ELSIF position('requested_revision <> current_revision' IN definition) = 0 THEN
      RAISE EXCEPTION 'unexpected calc preparation function: %', function_id;
    END IF;

    definition := replace(definition, old_error, 'ERRCODE = ''PT409''');
    EXECUTE definition;
  END LOOP;
END;
$migration$;
