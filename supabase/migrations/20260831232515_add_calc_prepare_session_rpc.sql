CREATE INDEX IF NOT EXISTS calc_problem_state_user_block_priority_idx
  ON public.calc_problem_state (user_id, block_id, needs_remediation DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION public.prepare_calc_session(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  requested_blocks text[];
  requested_count integer;
  requested_revision bigint;
  current_revision bigint;
  candidate_json jsonb;
  block_json jsonb;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_request->'blockIds') <> 'array'
     OR jsonb_array_length(p_request->'blockIds') NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'blockIds must contain 1..50 entries' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(value ORDER BY value), count(DISTINCT value)
  INTO requested_blocks, requested_count
  FROM jsonb_array_elements_text(p_request->'blockIds');
  IF requested_count <> cardinality(requested_blocks)
     OR EXISTS (SELECT 1 FROM unnest(requested_blocks) block_id WHERE length(block_id) NOT BETWEEN 1 AND 100) THEN
    RAISE EXCEPTION 'invalid or duplicate blockIds' USING ERRCODE = '22023';
  END IF;

  requested_count := COALESCE((p_request->>'count')::integer, 0);
  requested_revision := COALESCE((p_request->>'expectedRevision')::bigint, -1);
  IF requested_count NOT BETWEEN 1 AND 200
     OR p_request->>'mode' NOT IN ('daily', 'free', 'mistakes') THEN
    RAISE EXCEPTION 'invalid prepare request' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(state_revision, 0) INTO current_revision
  FROM public.calc_user_runtime WHERE user_id = owner_id;
  current_revision := COALESCE(current_revision, 0);
  IF requested_revision <> current_revision THEN
    RAISE EXCEPTION 'calc revision conflict' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(requested_blocks) requested(block_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.calc_curriculum_registry registry
      WHERE registry.block_id = requested.block_id AND registry.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'unknown or inactive calc curriculum block' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(candidate ORDER BY priority, updated_at, signature), '[]'::jsonb)
  INTO candidate_json
  FROM (
    SELECT
      CASE
        WHEN state.needs_remediation THEN 0
        WHEN state.status IN ('lagging', 'forced') THEN 1
        WHEN state.status = 'review' THEN 2
        WHEN state.status = 'mastered' THEN 4
        ELSE 3
      END AS priority,
      state.updated_at,
      state.signature,
      jsonb_build_object(
        'selectionReason', CASE
          WHEN state.needs_remediation THEN 'carried-mistake'
          WHEN state.status IN ('lagging', 'forced') THEN 'lagging'
          WHEN state.status = 'review' THEN 'maintenance'
          WHEN state.status = 'mastered' THEN 'mastered-recall'
          ELSE 'weak' END,
        'state', jsonb_build_object(
          'signature', state.signature,
          'level', CASE WHEN state.level = 99 THEN to_jsonb('C'::text) ELSE to_jsonb(state.level) END,
          'proficiency', state.proficiency,
          'attemptCount', state.attempt_count,
          'appearanceCount', state.appearance_count,
          'recentResults', state.recent_results,
          'status', state.status,
          'consecutiveWrong', state.consecutive_wrong,
          'consecutiveCorrect', state.consecutive_correct,
          'lastWithinLimit', state.last_within_limit,
          'updatedAt', state.updated_at,
          'blockId', state.block_id,
          'mixedOpId', state.mixed_op_id,
          'needsRemediation', state.needs_remediation,
          'lastWrongAt', state.last_wrong_at,
          'lastWrongSessionNo', state.last_wrong_session_no,
          'lastErrorTag', state.last_error_tag,
          'lastUserAnswer', state.last_user_answer,
          'lastAnswerJson', state.last_answer_json,
          'remediationCorrectCount', state.remediation_correct_count,
          'appliedRevision', state.applied_revision
        )
      ) AS candidate
    FROM public.calc_problem_state state
    WHERE state.user_id = owner_id AND state.block_id = ANY(requested_blocks)
    ORDER BY priority, state.updated_at, state.signature
    LIMIT requested_count
  ) bounded;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'blockId', progress.block_id,
    'curriculumVersion', progress.curriculum_version,
    'universeSize', progress.universe_size,
    'coveredCount', progress.covered_count,
    'withinTargetCount', progress.within_target_count,
    'fluentCount', progress.fluent_count,
    'masteredCount', progress.mastered_count,
    'reviewDueCount', progress.review_due_count,
    'recentIndependentCorrect', progress.recent_independent_correct,
    'recentIndependentTotal', progress.recent_independent_total,
    'stableCount', progress.stable_count,
    'tier', progress.tier,
    'ready', progress.ready,
    'recovery', progress.recovery,
    'appliedRevision', progress.applied_revision,
    'healthStatus', progress.health_status
  ) ORDER BY progress.block_id), '[]'::jsonb)
  INTO block_json
  FROM public.calc_block_progress progress
  WHERE progress.user_id = owner_id AND progress.block_id = ANY(requested_blocks);

  RETURN jsonb_build_object(
    'revision', current_revision,
    'candidates', candidate_json,
    'blocks', block_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_calc_session(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_calc_session(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.prepare_calc_session(jsonb) TO authenticated;
