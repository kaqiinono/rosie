-- Bounded report read model. Classification and evidence live on the same row as
-- the authoritative problem state, so every write path changes them together.
ALTER TABLE public.calc_problem_state
  ADD COLUMN report_facets_version integer
    CHECK (report_facets_version IS NULL OR report_facets_version BETWEEN 1 AND 1000),
  ADD COLUMN report_concept_key text,
  ADD COLUMN report_structure_facets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN report_rule_key text,
  ADD COLUMN report_covered boolean NOT NULL DEFAULT false,
  ADD COLUMN report_within_target boolean NOT NULL DEFAULT false,
  ADD COLUMN report_fluent boolean NOT NULL DEFAULT false,
  ADD COLUMN report_mastered boolean NOT NULL DEFAULT false,
  ADD COLUMN report_review_due boolean NOT NULL DEFAULT false,
  ADD COLUMN report_stable boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT calc_problem_state_report_structure_facets_array
    CHECK (jsonb_typeof(report_structure_facets) = 'array');

CREATE INDEX calc_problem_state_user_report_concept_idx
  ON public.calc_problem_state (user_id, block_id, report_concept_key)
  WHERE report_concept_key IS NOT NULL;
CREATE INDEX calc_problem_state_user_report_rule_idx
  ON public.calc_problem_state (user_id, report_rule_key)
  WHERE report_rule_key IS NOT NULL;

-- Preserve the proven settlement implementation and wrap it so report projection
-- writes share the exact same transaction and revision.
ALTER FUNCTION public.settle_calc_session(jsonb)
  RENAME TO settle_calc_session_without_report_projection;
REVOKE ALL ON FUNCTION public.settle_calc_session_without_report_projection(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_calc_session_without_report_projection(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.settle_calc_session_without_report_projection(jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.settle_calc_session(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  result jsonb;
  state_item jsonb;
  result_revision bigint;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  result := public.settle_calc_session_without_report_projection(p_payload);
  result_revision := (result->>'revision')::bigint;

  FOR state_item IN SELECT value FROM jsonb_array_elements(p_payload->'problem_states')
  LOOP
    -- During a rolling deployment, the previous client may omit report facets.
    -- Its settlement remains valid; projection health becomes incomplete until
    -- the resumable rebuild fills that row.
    IF state_item ? 'report_facets_version' THEN
      IF COALESCE((state_item->>'report_facets_version')::integer, 0) <> 1
         OR jsonb_typeof(COALESCE(state_item->'report_structure_facets', '[]'::jsonb)) <> 'array'
         OR jsonb_array_length(COALESCE(state_item->'report_structure_facets', '[]'::jsonb)) > 20 THEN
        RAISE EXCEPTION 'invalid calc report facets' USING ERRCODE = '22023';
      END IF;

      UPDATE public.calc_problem_state SET
        report_facets_version = (state_item->>'report_facets_version')::integer,
        report_concept_key = NULLIF(state_item->>'report_concept_key', ''),
        report_structure_facets = COALESCE(state_item->'report_structure_facets', '[]'::jsonb),
        report_rule_key = NULLIF(state_item->>'report_rule_key', ''),
        report_covered = COALESCE((state_item->>'report_covered')::boolean, false),
        report_within_target = COALESCE((state_item->>'report_within_target')::boolean, false),
        report_fluent = COALESCE((state_item->>'report_fluent')::boolean, false),
        report_mastered = COALESCE((state_item->>'report_mastered')::boolean, false),
        report_review_due = COALESCE((state_item->>'report_review_due')::boolean, false),
        report_stable = COALESCE((state_item->>'report_stable')::boolean, false)
      WHERE user_id = owner_id AND signature = state_item->>'signature'
        AND applied_revision = result_revision;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'calc report projection revision conflict' USING ERRCODE = '40001';
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_calc_session(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_calc_session(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_calc_session(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_calc_report_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH runtime AS (
    SELECT COALESCE((SELECT state_revision FROM public.calc_user_runtime
      WHERE user_id = auth.uid()), 0) AS revision
  ), counts AS (
    SELECT
      (SELECT count(*) FROM public.calc_problem_state WHERE user_id = auth.uid()) AS state_count,
      (SELECT count(*) FROM public.calc_problem_state
        WHERE user_id = auth.uid() AND report_facets_version = 1) AS projection_count,
      (SELECT count(*) FROM public.calc_curriculum_registry
        WHERE status = 'active' AND coverage_kind = 'formula') AS expected_block_count,
      (SELECT count(*) FROM public.calc_block_progress AS progress
        JOIN public.calc_curriculum_registry AS registry
          ON registry.block_id = progress.block_id
          AND registry.curriculum_version = progress.curriculum_version
        WHERE progress.user_id = auth.uid() AND progress.health_status = 'healthy'
          AND registry.status = 'active' AND registry.coverage_kind = 'formula') AS projected_block_count
  ), block_state_rollup AS (
    SELECT block_id,
      count(*) FILTER (WHERE report_stable)::integer AS stable_count,
      count(*) FILTER (WHERE report_review_due)::integer AS review_due_count
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
  ), block_metrics AS (
    SELECT progress.*,
      COALESCE(states.stable_count, 0) AS derived_stable_count,
      COALESCE(states.review_due_count, 0) AS derived_review_due_count,
      COALESCE(accuracy.correct, 0) AS derived_recent_correct,
      COALESCE(accuracy.total, 0) AS derived_recent_total
    FROM public.calc_block_progress AS progress
    LEFT JOIN block_state_rollup AS states USING (block_id)
    LEFT JOIN recent_accuracy AS accuracy USING (block_id)
    WHERE progress.user_id = auth.uid() AND progress.coverage_kind = 'formula'
  ), concept_facts AS (
    SELECT block_id, report_concept_key AS concept_key,
      bool_or(report_covered) AS covered,
      bool_or(report_within_target) AS within_target,
      bool_or(report_fluent) AS fluent,
      bool_or(report_mastered) AS mastered,
      bool_or(report_review_due) AS review_due
    FROM public.calc_problem_state
    WHERE user_id = auth.uid() AND report_concept_key IS NOT NULL
      AND report_facets_version = 1
    GROUP BY block_id, report_concept_key
  ), concept_blocks AS (
    SELECT block_id,
      count(*)::integer AS observed_total,
      count(*) FILTER (WHERE covered)::integer AS covered,
      count(*) FILTER (WHERE within_target)::integer AS within_target,
      count(*) FILTER (WHERE fluent)::integer AS fluent,
      count(*) FILTER (WHERE mastered)::integer AS mastered,
      count(*) FILTER (WHERE review_due AND NOT fluent)::integer AS review_due
    FROM concept_facts GROUP BY block_id
  ), structure_cells AS (
    SELECT state.signature, facet->>'modelId' AS model_id, cell.value AS cell_key,
      state.report_covered AS covered, state.report_fluent AS fluent,
      state.report_mastered AS mastered, state.report_review_due AS review_due
    FROM public.calc_problem_state AS state
    CROSS JOIN LATERAL jsonb_array_elements(state.report_structure_facets) AS facet
    CROSS JOIN LATERAL jsonb_array_elements_text(facet->'cellKeys') AS cell(value)
    WHERE state.user_id = auth.uid() AND state.report_facets_version = 1
  ), structure_rollup AS (
    SELECT model_id, cell_key,
      bool_or(covered) AS covered,
      bool_or(fluent) AS fluent,
      bool_or(mastered) AS mastered,
      bool_or(review_due) AS review_due,
      (array_agg(signature ORDER BY signature) FILTER (WHERE covered))[1:3] AS samples
    FROM structure_cells GROUP BY model_id, cell_key
  ), rule_rollup AS (
    SELECT report_rule_key AS rule_key,
      count(*) FILTER (WHERE report_covered)::integer AS covered,
      count(*) FILTER (WHERE report_mastered)::integer AS mastered,
      (array_agg(signature ORDER BY signature) FILTER (WHERE report_covered))[1:3] AS samples
    FROM public.calc_problem_state
    WHERE user_id = auth.uid() AND report_rule_key IS NOT NULL
      AND report_facets_version = 1
    GROUP BY report_rule_key
  ), recent_sessions AS (
    SELECT id, question_log
    FROM public.calc_sessions
    WHERE user_id = auth.uid()
    ORDER BY finished_at DESC
    LIMIT 30
  ), audit_entries AS (
    SELECT session.id, entry.value,
      lag(entry.value->>'signature') OVER (PARTITION BY session.id ORDER BY entry.ordinality) AS previous_signature
    FROM recent_sessions AS session
    CROSS JOIN LATERAL jsonb_array_elements(session.question_log)
      WITH ORDINALITY AS entry(value, ordinality)
    WHERE NULLIF(entry.value->>'signature', '') IS NOT NULL
  ), repeat_audit AS (
    SELECT count(*)::integer AS questions,
      count(*) FILTER (WHERE COALESCE((value->>'occurrenceInSession')::integer, 1) > 1)::integer AS repeats,
      count(*) FILTER (WHERE COALESCE((value->>'occurrenceInSession')::integer, 1) > 1
        AND COALESCE((value->>'intentionalRepeat')::boolean, false))::integer AS intentional,
      count(*) FILTER (WHERE COALESCE((value->>'occurrenceInSession')::integer, 1) > 1
        AND NOT COALESCE((value->>'intentionalRepeat')::boolean, false))::integer AS accidental,
      count(*) FILTER (WHERE previous_signature = value->>'signature')::integer AS consecutive
    FROM audit_entries
  )
  SELECT jsonb_build_object(
    'revision', runtime.revision,
    'projection', jsonb_build_object(
      'version', 1,
      'stateCount', counts.state_count,
      'projectedStateCount', counts.projection_count,
      'expectedBlockCount', counts.expected_block_count,
      'projectedBlockCount', counts.projected_block_count,
      'complete', counts.state_count = counts.projection_count
        AND counts.expected_block_count = counts.projected_block_count
    ),
    'blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'blockId', block_id, 'curriculumVersion', curriculum_version,
        'universeSize', universe_size, 'coveredCount', covered_count,
        'withinTargetCount', within_target_count, 'fluentCount', fluent_count,
        'masteredCount', mastered_count, 'reviewDueCount', derived_review_due_count,
        'recentIndependentCorrect', derived_recent_correct,
        'recentIndependentTotal', derived_recent_total, 'stableCount', derived_stable_count,
        'tier', tier,
        'ready', covered_count::numeric / universe_size >= 0.9
          AND (derived_recent_total = 0 OR derived_recent_correct::numeric / derived_recent_total >= 0.85)
          AND derived_stable_count::numeric / universe_size >= 0.75
          AND fluent_count::numeric / universe_size >= 0.6,
        'recovery', derived_recent_total > 0 AND (
          derived_recent_correct::numeric / derived_recent_total < 0.7
          OR derived_review_due_count::numeric / universe_size > 0.15
        ),
        'appliedRevision', applied_revision, 'healthStatus', health_status,
        'coveredBits', encode(formula_covered_bits, 'hex'),
        'withinTargetBits', encode(formula_within_target_bits, 'hex'),
        'fluentBits', encode(formula_fluent_bits, 'hex'),
        'masteredBits', encode(formula_mastered_bits, 'hex')
      ) ORDER BY block_id)
      FROM block_metrics
    ), '[]'::jsonb),
    'concepts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'blockId', block_id, 'observedTotal', observed_total,
        'covered', covered, 'withinTarget', within_target, 'fluent', fluent,
        'mastered', mastered, 'reviewDue', review_due
      ) ORDER BY block_id) FROM concept_blocks
    ), '[]'::jsonb),
    'structures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'modelId', model_id, 'cellKey', cell_key, 'covered', covered,
        'fluent', fluent, 'mastered', mastered, 'reviewDue', review_due,
        'sampleSignatures', COALESCE(to_jsonb(samples), '[]'::jsonb)
      ) ORDER BY model_id, cell_key) FROM structure_rollup
    ), '[]'::jsonb),
    'rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ruleKey', rule_key, 'covered', covered, 'mastered', mastered,
        'sampleSignatures', COALESCE(to_jsonb(samples), '[]'::jsonb)
      ) ORDER BY rule_key) FROM rule_rollup
    ), '[]'::jsonb),
    'repeatAudit', jsonb_build_object(
      'questions', repeat_audit.questions, 'repeats', repeat_audit.repeats,
      'intentional', repeat_audit.intentional, 'accidental', repeat_audit.accidental,
      'consecutive', repeat_audit.consecutive
    )
  )
  FROM runtime CROSS JOIN counts CROSS JOIN repeat_audit;
$$;

REVOKE ALL ON FUNCTION public.get_calc_report_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calc_report_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_calc_report_summary() TO authenticated;
