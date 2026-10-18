-- Retire the legacy calc_mistakes write projection while preserving a private rollback copy.
-- The application reads remediation state from calc_problem_state before this migration is deployed.

CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC;
REVOKE ALL ON SCHEMA archive FROM anon;
REVOKE ALL ON SCHEMA archive FROM authenticated;

CREATE TABLE IF NOT EXISTS archive.calc_mistakes_20260901
(LIKE public.calc_mistakes INCLUDING ALL);

INSERT INTO archive.calc_mistakes_20260901
SELECT * FROM public.calc_mistakes
ON CONFLICT DO NOTHING;

REVOKE ALL ON TABLE archive.calc_mistakes_20260901 FROM PUBLIC;
REVOKE ALL ON TABLE archive.calc_mistakes_20260901 FROM anon;
REVOKE ALL ON TABLE archive.calc_mistakes_20260901 FROM authenticated;

-- Forward fix: multiple formula mutations for one block share the same settlement revision.\n-- Atomic calc settlement and bounded server reads.
-- Requires 20260831004809_add_calc_unified_state_foundation.sql.

CREATE OR REPLACE FUNCTION public.settle_calc_session(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  idem uuid;
  expected_revision bigint;
  next_revision bigint;
  next_session_no bigint;
  schema_version integer;
  session_data jsonb;
  question_log jsonb;
  state_item jsonb;
  log_item jsonb;
  progress_item jsonb;
  existing public.calc_sessions%ROWTYPE;
  log_count integer;
  correct_count integer;
  retry_count integer;
  wrong_count integer;
  time_spent_sec integer;
  target_block text;
  target_version text;
  target_size integer;
  target_kind text;
  target_index integer;
  zero_bits bytea;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be an object' USING ERRCODE = '22023';
  END IF;

  BEGIN
    idem := (p_payload->>'idempotency_key')::uuid;
    expected_revision := (p_payload->>'expected_revision')::bigint;
    schema_version := (p_payload->>'client_schema_version')::integer;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid settlement identity' USING ERRCODE = '22023';
  END;
  IF expected_revision < 0 OR schema_version <> 1 THEN
    RAISE EXCEPTION 'unsupported settlement revision or schema' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing
  FROM public.calc_sessions
  WHERE user_id = owner_id AND idempotency_key = idem;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'sessionId', existing.id,
      'sessionNo', existing.session_no,
      'revision', existing.state_revision,
      'idempotentReplay', true
    );
  END IF;

  INSERT INTO public.calc_user_runtime (user_id)
  VALUES (owner_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT state_revision, last_session_no
  INTO next_revision, next_session_no
  FROM public.calc_user_runtime
  WHERE user_id = owner_id
  FOR UPDATE;
  IF next_revision <> expected_revision THEN
    RAISE EXCEPTION 'calc revision conflict: expected %, current %', expected_revision, next_revision
      USING ERRCODE = '40001', DETAIL = jsonb_build_object('currentRevision', next_revision)::text;
  END IF;
  next_revision := next_revision + 1;
  next_session_no := next_session_no + 1;

  session_data := p_payload->'session';
  question_log := session_data->'question_log';
  IF jsonb_typeof(session_data) <> 'object'
     OR jsonb_typeof(question_log) <> 'array'
     OR jsonb_array_length(question_log) NOT BETWEEN 1 AND 500
     OR pg_column_size(question_log) > 1048576 THEN
    RAISE EXCEPTION 'invalid calc session payload' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(question_log) AS entry
    WHERE NULLIF(entry->>'signature', '') IS NULL
       OR entry->>'ms' IS NULL
       OR (entry->>'ms')::numeric < 0
       OR entry->>'finallyOk' IS NULL
       OR NULLIF(entry->>'evidenceKind', '') IS NULL
       OR NULLIF(entry->>'presentationKey', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'incomplete calc question evidence' USING ERRCODE = '22023';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE COALESCE((entry->>'ok')::boolean, false))::integer,
    count(*) FILTER (
      WHERE NOT COALESCE((entry->>'ok')::boolean, false)
        AND COALESCE((entry->>'finallyOk')::boolean, false)
    )::integer,
    count(*) FILTER (WHERE NOT COALESCE((entry->>'finallyOk')::boolean, false))::integer,
    round(sum((entry->>'ms')::numeric) / 1000)::integer
  INTO log_count, correct_count, retry_count, wrong_count, time_spent_sec
  FROM jsonb_array_elements(question_log) AS entry;

  IF jsonb_typeof(p_payload->'problem_states') <> 'array'
     OR jsonb_array_length(p_payload->'problem_states') > 500 THEN
    RAISE EXCEPTION 'invalid problem state transitions' USING ERRCODE = '22023';
  END IF;

  FOR state_item IN SELECT value FROM jsonb_array_elements(p_payload->'problem_states')
  LOOP
    IF NULLIF(state_item->>'signature', '') IS NULL
       OR COALESCE((state_item->>'applied_revision')::bigint, 0) > expected_revision THEN
      RAISE EXCEPTION 'invalid or stale problem state transition' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.calc_problem_state (
      user_id, signature, level, proficiency, attempt_count, appearance_count,
      recent_results, status, consecutive_wrong, consecutive_correct,
      last_within_limit, updated_at, block_id, mixed_op_id, needs_remediation,
      last_wrong_at, last_wrong_session_no, last_error_tag, last_user_answer,
      last_answer_json, remediation_correct_count, applied_revision
    ) VALUES (
      owner_id, state_item->>'signature', (state_item->>'level')::smallint,
      (state_item->>'proficiency')::smallint, (state_item->>'attempt_count')::integer,
      (state_item->>'appearance_count')::integer, COALESCE(state_item->'recent_results', '[]'::jsonb),
      state_item->>'status', (state_item->>'consecutive_wrong')::integer,
      (state_item->>'consecutive_correct')::integer,
      CASE WHEN state_item ? 'last_within_limit' THEN (state_item->>'last_within_limit')::boolean END,
      now(), NULLIF(state_item->>'block_id', ''), NULLIF(state_item->>'mixed_op_id', ''),
      COALESCE((state_item->>'needs_remediation')::boolean, false),
      NULLIF(state_item->>'last_wrong_at', '')::timestamptz,
      NULLIF(state_item->>'last_wrong_session_no', '')::bigint,
      NULLIF(state_item->>'last_error_tag', ''), NULLIF(state_item->>'last_user_answer', ''),
      state_item->'last_answer_json', COALESCE((state_item->>'remediation_correct_count')::smallint, 0),
      next_revision
    )
    ON CONFLICT (user_id, signature) DO UPDATE SET
      level = EXCLUDED.level, proficiency = EXCLUDED.proficiency,
      attempt_count = EXCLUDED.attempt_count, appearance_count = EXCLUDED.appearance_count,
      recent_results = EXCLUDED.recent_results, status = EXCLUDED.status,
      consecutive_wrong = EXCLUDED.consecutive_wrong,
      consecutive_correct = EXCLUDED.consecutive_correct,
      last_within_limit = EXCLUDED.last_within_limit, updated_at = now(),
      block_id = EXCLUDED.block_id, mixed_op_id = EXCLUDED.mixed_op_id,
      needs_remediation = EXCLUDED.needs_remediation,
      last_wrong_at = EXCLUDED.last_wrong_at,
      last_wrong_session_no = EXCLUDED.last_wrong_session_no,
      last_error_tag = EXCLUDED.last_error_tag,
      last_user_answer = EXCLUDED.last_user_answer,
      last_answer_json = EXCLUDED.last_answer_json,
      remediation_correct_count = EXCLUDED.remediation_correct_count,
      applied_revision = EXCLUDED.applied_revision
    WHERE public.calc_problem_state.applied_revision <= expected_revision;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'problem state revision conflict' USING ERRCODE = '40001';
    END IF;

  END LOOP;

  IF jsonb_typeof(COALESCE(p_payload->'progress_items', '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_payload->'progress_items', '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'invalid progress mutations' USING ERRCODE = '22023';
  END IF;
  FOR progress_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'progress_items', '[]'::jsonb))
  LOOP
    target_block := progress_item->>'block_id';
    target_version := progress_item->>'curriculum_version';
    target_index := (progress_item->>'curriculum_index')::integer;
    SELECT universe_size, coverage_kind INTO target_size, target_kind
    FROM public.calc_curriculum_registry
    WHERE block_id = target_block AND curriculum_version = target_version AND status = 'active';
    IF NOT FOUND OR target_kind <> 'formula' OR target_index NOT BETWEEN 0 AND target_size - 1 THEN
      RAISE EXCEPTION 'unknown or inactive calc curriculum item' USING ERRCODE = '22023';
    END IF;
    zero_bits := decode(repeat('00', (target_size + 7) / 8), 'hex');
    INSERT INTO public.calc_block_progress (
      user_id, block_id, curriculum_version, universe_size, coverage_kind,
      formula_covered_bits, formula_within_target_bits, formula_fluent_bits,
      formula_mastered_bits, applied_revision, health_status
    ) VALUES (
      owner_id, target_block, target_version, target_size, 'formula',
      zero_bits, zero_bits, zero_bits, zero_bits, next_revision, 'healthy'
    ) ON CONFLICT (user_id, block_id, curriculum_version) DO NOTHING;

    UPDATE public.calc_block_progress SET
      formula_covered_bits = CASE WHEN COALESCE((progress_item->>'covered')::boolean, false)
        THEN set_bit(formula_covered_bits, target_index, 1) ELSE formula_covered_bits END,
      formula_within_target_bits = CASE WHEN COALESCE((progress_item->>'within_target')::boolean, false)
        THEN set_bit(formula_within_target_bits, target_index, 1) ELSE formula_within_target_bits END,
      formula_fluent_bits = set_bit(formula_fluent_bits, target_index,
        CASE WHEN COALESCE((progress_item->>'fluent')::boolean, false) THEN 1 ELSE 0 END),
      formula_mastered_bits = set_bit(formula_mastered_bits, target_index,
        CASE WHEN COALESCE((progress_item->>'mastered')::boolean, false) THEN 1 ELSE 0 END),
      covered_count = bit_count(CASE WHEN COALESCE((progress_item->>'covered')::boolean, false)
        THEN set_bit(formula_covered_bits, target_index, 1) ELSE formula_covered_bits END)::integer,
      within_target_count = bit_count(CASE WHEN COALESCE((progress_item->>'within_target')::boolean, false)
        THEN set_bit(formula_within_target_bits, target_index, 1) ELSE formula_within_target_bits END)::integer,
      fluent_count = bit_count(set_bit(formula_fluent_bits, target_index,
        CASE WHEN COALESCE((progress_item->>'fluent')::boolean, false) THEN 1 ELSE 0 END))::integer,
      mastered_count = bit_count(set_bit(formula_mastered_bits, target_index,
        CASE WHEN COALESCE((progress_item->>'mastered')::boolean, false) THEN 1 ELSE 0 END))::integer,
      applied_revision = next_revision, health_status = 'healthy', updated_at = now()
    WHERE user_id = owner_id AND block_id = target_block
      AND curriculum_version = target_version
      AND applied_revision IN (expected_revision, next_revision);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'block progress revision conflict' USING ERRCODE = '40001';
    END IF;
  END LOOP;

  UPDATE public.calc_block_progress AS progress SET
    covered_count = bit_count(progress.formula_covered_bits)::integer,
    within_target_count = bit_count(progress.formula_within_target_bits)::integer,
    fluent_count = bit_count(progress.formula_fluent_bits)::integer,
    mastered_count = bit_count(progress.formula_mastered_bits)::integer,
    updated_at = now()
  WHERE progress.user_id = owner_id AND progress.applied_revision = next_revision;

  INSERT INTO public.calc_sessions (
    user_id, date, started_at, finished_at, count, correct_count, retry_count,
    wrong_count, challenge_correct, time_spent_sec, mode, max_streak, top_level,
    question_times_ms, question_log, idempotency_key, session_no, state_revision,
    client_schema_version
  ) VALUES (
    owner_id, (session_data->>'date')::date,
    (session_data->>'started_at')::timestamptz, (session_data->>'finished_at')::timestamptz,
    log_count, correct_count, retry_count, wrong_count,
    COALESCE((session_data->>'challenge_correct')::smallint, 0), time_spent_sec,
    session_data->>'mode', COALESCE((session_data->>'max_streak')::smallint, 0),
    session_data->>'top_level', COALESCE(session_data->'question_times_ms', '[]'::jsonb),
    question_log, idem, next_session_no, next_revision, schema_version
  ) RETURNING * INTO existing;

  IF COALESCE((p_payload->>'reward_delta')::integer, 0) <> 0 THEN
    INSERT INTO public.star_sessions (user_id, date, source, coins_earned, ref_id)
    VALUES (owner_id, session_data->>'date', 'calc', (p_payload->>'reward_delta')::integer, existing.id)
    ON CONFLICT (user_id, source, ref_id) WHERE ref_id IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.calc_user_runtime SET
    state_revision = next_revision, last_session_no = next_session_no, updated_at = now()
  WHERE user_id = owner_id;

  RETURN jsonb_build_object(
    'sessionId', existing.id, 'sessionNo', next_session_no,
    'revision', next_revision, 'idempotentReplay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_calc_session(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_calc_session(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_calc_session(jsonb) TO authenticated;
