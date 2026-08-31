-- Read-only preflight for calc unified settlement.
-- Run manually against a reviewed environment before activating registry,
-- creating the reward idempotency index, or tightening legacy grants.

BEGIN TRANSACTION READ ONLY;

-- Table sizes and estimated row counts.
SELECT
  rel.relname AS table_name,
  rel.reltuples::bigint AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(rel.oid)) AS total_size
FROM pg_class AS rel
JOIN pg_namespace AS namespace ON namespace.oid = rel.relnamespace
WHERE namespace.nspname = 'public'
  AND rel.relname IN (
    'calc_sessions',
    'calc_problem_state',
    'calc_mistakes',
    'calc_settings',
    'calc_curriculum_progress',
    'calc_curriculum_completed',
    'calc_curriculum_history_audit',
    'calc_curriculum_snapshots',
    'calc_curriculum_registry',
    'calc_user_runtime',
    'calc_block_progress',
    'star_sessions'
  )
ORDER BY rel.relname;

-- Deployed 20260828102247 prototype. These tables may exist even when the
-- current worktree's snapshot prototype was never deployed. Keep pointer /
-- assessment runtime separate from the final aggregate projection.
SELECT rel.relname AS deployed_prototype_table, rel.reltuples::bigint AS estimated_rows
FROM pg_class AS rel
JOIN pg_namespace AS namespace ON namespace.oid = rel.relnamespace
WHERE namespace.nspname = 'public'
  AND rel.relname IN (
    'calc_curriculum_progress',
    'calc_curriculum_completed',
    'calc_curriculum_history_audit'
  )
ORDER BY rel.relname;

-- Largest per-user state footprint (identities intentionally omitted).
SELECT
  count(*) AS users_with_state,
  max(problem_count) AS max_problem_states,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY problem_count) AS median_problem_states,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY problem_count) AS p95_problem_states
FROM (
  SELECT user_id, count(*) AS problem_count
  FROM public.calc_problem_state
  GROUP BY user_id
) AS per_user;

-- Legacy session-log completeness and payload size.
SELECT
  count(*) AS sessions,
  count(*) FILTER (WHERE jsonb_typeof(question_log) = 'array') AS array_logs,
  count(*) FILTER (WHERE jsonb_array_length(question_log) = 0) AS empty_logs,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(question_log) AS entry
      WHERE NULLIF(entry->>'signature', '') IS NULL OR entry->>'ms' IS NULL
    )
  ) AS incomplete_core_evidence,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(question_log) AS entry
      WHERE entry->>'evidenceKind' IS NULL OR entry->>'presentationKey' IS NULL
    )
  ) AS incomplete_v1_evidence,
  max(pg_column_size(question_log)) AS max_question_log_bytes,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY pg_column_size(question_log)) AS p95_question_log_bytes
FROM public.calc_sessions;

-- Candidate session ordinals and legacy counter divergence.
SELECT
  count(*) AS users,
  count(*) FILTER (WHERE session_rows <> settings_counter) AS divergent_users,
  max(abs(session_rows - settings_counter)) AS max_absolute_delta
FROM (
  SELECT
    settings.user_id,
    settings.session_counter::bigint AS settings_counter,
    count(session.id)::bigint AS session_rows
  FROM public.calc_settings AS settings
  LEFT JOIN public.calc_sessions AS session ON session.user_id = settings.user_id
  GROUP BY settings.user_id, settings.session_counter
) AS counters;

-- Reward duplicates that would block the reviewed partial unique index.
SELECT
  source,
  count(*) AS duplicate_groups,
  sum(row_count - 1) AS excess_rows
FROM (
  SELECT user_id, source, ref_id, count(*) AS row_count
  FROM public.star_sessions
  WHERE ref_id IS NOT NULL
  GROUP BY user_id, source, ref_id
  HAVING count(*) > 1
) AS duplicates
GROUP BY source
ORDER BY source;

-- Legacy mistakes versus unified remediation projection. This query is valid
-- after the additive foundation migration has added the new columns.
SELECT
  count(*) FILTER (WHERE NOT mistake.resolved) AS legacy_unresolved,
  count(*) FILTER (WHERE state.needs_remediation) AS projected_remediation,
  count(*) FILTER (WHERE NOT mistake.resolved AND NOT COALESCE(state.needs_remediation, false))
    AS missing_projection,
  count(*) FILTER (WHERE mistake.resolved AND COALESCE(state.needs_remediation, false))
    AS resolved_but_projected,
  count(*) FILTER (
    WHERE state.needs_remediation
      AND state.remediation_correct_count <> LEAST(3, GREATEST(0, mistake.consecutive_correct))
  ) AS correct_count_mismatch
FROM public.calc_mistakes AS mistake
LEFT JOIN public.calc_problem_state AS state
  ON state.user_id = mistake.user_id
 AND state.signature = mistake.signature;

-- RLS policies and grants for all calc projection/fact tables.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'calc_%'
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name LIKE 'calc_%'
ORDER BY table_name, grantee, privilege_type;

-- Relevant indexes and definitions.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'calc_%' OR tablename = 'star_sessions')
ORDER BY tablename, indexname;

ROLLBACK;
