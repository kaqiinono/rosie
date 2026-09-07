-- Bounded auxiliary report sources for non-finite curricula and formula timelines.

CREATE OR REPLACE FUNCTION public.get_calc_report_auxiliary()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH runtime AS (
    SELECT COALESCE((SELECT state_revision FROM public.calc_user_runtime
      WHERE user_id = auth.uid()), 0) AS revision
  ), structure_cells AS (
    SELECT facet->>'modelId' AS model_id, cell.value AS cell_key,
      state.report_covered AS covered, state.report_fluent AS fluent,
      state.report_mastered AS mastered, state.report_review_due AS review_due
    FROM public.calc_problem_state AS state
    CROSS JOIN LATERAL jsonb_array_elements(state.report_structure_facets) AS facet
    CROSS JOIN LATERAL jsonb_array_elements_text(facet->'cellKeys') AS cell(value)
    WHERE state.user_id = auth.uid() AND state.report_facets_version = 1
  ), structure_rollup AS (
    SELECT model_id, cell_key,
      bool_or(covered) AS covered, bool_or(fluent) AS fluent,
      bool_or(mastered) AS mastered, bool_or(review_due) AS review_due
    FROM structure_cells GROUP BY model_id, cell_key
  ), structure_blocks AS (
    SELECT model_id,
      count(*) FILTER (WHERE covered)::integer AS covered_count,
      count(*) FILTER (WHERE fluent)::integer AS fluent_count,
      count(*) FILTER (WHERE mastered)::integer AS mastered_count,
      count(*) FILTER (WHERE review_due)::integer AS review_due_count
    FROM structure_rollup GROUP BY model_id
  ), state_rollup AS (
    SELECT block_id, count(*) FILTER (WHERE report_stable)::integer AS stable_count
    FROM public.calc_problem_state
    WHERE user_id = auth.uid() AND block_id IS NOT NULL AND report_facets_version = 1
    GROUP BY block_id
  ), independent_attempts AS (
    SELECT state.block_id, attempt.value,
      NULLIF(attempt.value->>'sessionNo', '')::bigint AS session_no
    FROM public.calc_problem_state AS state
    CROSS JOIN LATERAL jsonb_array_elements(state.recent_results) AS attempt(value)
    WHERE state.user_id = auth.uid() AND state.block_id IS NOT NULL
      AND COALESCE(attempt.value->>'evidenceKind', 'independent') NOT IN ('makeup', 'recall')
  ), ranked_attempts AS (
    SELECT *, dense_rank() OVER (PARTITION BY block_id ORDER BY session_no DESC NULLS LAST) AS session_rank
    FROM independent_attempts
  ), recent_accuracy AS (
    SELECT block_id,
      count(*) FILTER (WHERE COALESCE((value->>'correct')::boolean, false))::integer AS correct,
      count(*)::integer AS total
    FROM ranked_attempts
    WHERE session_no IS NULL OR session_rank <= 3
    GROUP BY block_id
  ), ability_blocks AS (
    SELECT registry.block_id, registry.curriculum_version, registry.universe_size,
      COALESCE(structure.covered_count, 0) AS covered_count,
      COALESCE(structure.fluent_count, 0) AS fluent_count,
      COALESCE(structure.mastered_count, 0) AS mastered_count,
      COALESCE(structure.review_due_count, 0) AS review_due_count,
      COALESCE(states.stable_count, 0) AS stable_count,
      COALESCE(accuracy.correct, 0) AS recent_correct,
      COALESCE(accuracy.total, 0) AS recent_total
    FROM public.calc_curriculum_registry AS registry
    LEFT JOIN structure_blocks AS structure ON structure.model_id = registry.block_id
    LEFT JOIN state_rollup AS states ON states.block_id = registry.block_id
    LEFT JOIN recent_accuracy AS accuracy ON accuracy.block_id = registry.block_id
    WHERE registry.status = 'active' AND registry.coverage_kind = 'structure'
  ), detail_sources AS (
    SELECT 'block'::text AS kind, block_id AS id, count(*)::integer AS formula_count
    FROM public.calc_problem_state
    WHERE user_id = auth.uid() AND block_id IS NOT NULL
    GROUP BY block_id
    UNION ALL
    SELECT 'mixed'::text, mixed_op_id, count(*)::integer
    FROM public.calc_problem_state
    WHERE user_id = auth.uid() AND mixed_op_id IS NOT NULL
    GROUP BY mixed_op_id
  )
  SELECT jsonb_build_object(
    'revision', runtime.revision,
    'blocks', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'blockId', block_id, 'curriculumVersion', curriculum_version,
      'universeSize', universe_size, 'coveredCount', covered_count,
      'withinTargetCount', 0, 'fluentCount', fluent_count,
      'masteredCount', mastered_count, 'reviewDueCount', review_due_count,
      'recentIndependentCorrect', recent_correct, 'recentIndependentTotal', recent_total,
      'stableCount', stable_count, 'tier', 'initial',
      'ready', covered_count::numeric / universe_size >= 0.9
        AND (recent_total = 0 OR recent_correct::numeric / recent_total >= 0.85)
        AND stable_count::numeric / universe_size >= 0.75
        AND fluent_count::numeric / universe_size >= 0.6,
      'recovery', recent_total > 0 AND (
        recent_correct::numeric / recent_total < 0.7
        OR review_due_count::numeric / universe_size > 0.15
      ),
      'appliedRevision', runtime.revision, 'healthStatus', 'healthy',
      'coveredBits', NULL, 'withinTargetBits', NULL,
      'fluentBits', NULL, 'masteredBits', NULL
    ) ORDER BY block_id) FROM ability_blocks), '[]'::jsonb),
    'detailSources', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'kind', kind, 'id', id, 'formulaCount', formula_count
    ) ORDER BY kind, id) FROM detail_sources), '[]'::jsonb)
  )
  FROM runtime;
$$;

REVOKE ALL ON FUNCTION public.get_calc_report_auxiliary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calc_report_auxiliary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_calc_report_auxiliary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_calc_formula_details(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  requested_limit integer := LEAST(100, GREATEST(1, COALESCE((p_request->>'limit')::integer, 50)));
  after_signature text := COALESCE(p_request->>'cursor', '');
  source_kind text := COALESCE(p_request->>'sourceKind', 'block');
  source_id text := p_request->>'blockId';
  rows_json jsonb;
  last_signature text;
BEGIN
  IF source_kind NOT IN ('block', 'mixed') OR NULLIF(source_id, '') IS NULL THEN
    RAISE EXCEPTION 'invalid calc detail source' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'signature'), '[]'::jsonb), max(item->>'signature')
  INTO rows_json, last_signature
  FROM (
    SELECT jsonb_build_object(
      'signature', signature,
      'state', jsonb_build_object(
        'signature', signature, 'level', CASE WHEN level = 99 THEN to_jsonb('C'::text) ELSE to_jsonb(level) END,
        'proficiency', proficiency, 'attemptCount', attempt_count,
        'appearanceCount', appearance_count, 'recentResults', recent_results,
        'status', status, 'consecutiveWrong', consecutive_wrong,
        'consecutiveCorrect', consecutive_correct, 'lastWithinLimit', last_within_limit,
        'updatedAt', updated_at, 'blockId', block_id, 'mixedOpId', mixed_op_id,
        'needsRemediation', needs_remediation, 'lastWrongAt', last_wrong_at,
        'lastWrongSessionNo', last_wrong_session_no, 'lastErrorTag', last_error_tag,
        'lastUserAnswer', last_user_answer, 'lastAnswerJson', last_answer_json,
        'remediationCorrectCount', remediation_correct_count, 'appliedRevision', applied_revision
      )
    ) AS item
    FROM public.calc_problem_state
    WHERE user_id = auth.uid()
      AND CASE source_kind WHEN 'mixed' THEN mixed_op_id = source_id ELSE block_id = source_id END
      AND signature > after_signature
      AND CASE p_request->>'status'
        WHEN 'mastered' THEN status = 'mastered'
        WHEN 'remediation' THEN needs_remediation
        WHEN 'review-due' THEN status IN ('review', 'lagging', 'forced')
        ELSE true END
    ORDER BY signature LIMIT requested_limit + 1
  ) page;
  IF jsonb_array_length(rows_json) > requested_limit THEN
    last_signature := rows_json->(requested_limit - 1)->>'signature';
    rows_json := rows_json - requested_limit;
  ELSE
    last_signature := NULL;
  END IF;
  RETURN jsonb_build_object(
    'items', rows_json, 'nextCursor', last_signature,
    'revision', COALESCE((SELECT state_revision FROM public.calc_user_runtime WHERE user_id = auth.uid()), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_calc_formula_details(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calc_formula_details(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_calc_formula_details(jsonb) TO authenticated;
