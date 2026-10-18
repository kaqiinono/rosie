-- Keep the existing validation and settlement transaction, but persist report
-- facets in the problem-state upsert instead of updating every row a second time.
-- This follows the revision-conflict correction in 20261018032420.
DO $migration$
DECLARE
  base_function constant regprocedure :=
    'public.settle_calc_session_without_report_projection(jsonb)'::regprocedure;
  wrapper_function constant regprocedure :=
    'public.settle_calc_session(jsonb)'::regprocedure;
  definition text;
  old_columns constant text :=
    E'      last_answer_json, remediation_correct_count, applied_revision\n    ) VALUES (';
  new_columns constant text :=
    E'      last_answer_json, remediation_correct_count, applied_revision,\n      report_facets_version, report_concept_key, report_structure_facets,\n      report_rule_key, report_covered, report_within_target, report_fluent,\n      report_mastered, report_review_due, report_stable\n    ) VALUES (';
  old_values constant text :=
    E'      next_revision\n    )\n    ON CONFLICT (user_id, signature) DO UPDATE SET';
  new_values constant text :=
    E'      next_revision,\n      NULLIF(state_item->>''report_facets_version'', '''')::integer,\n      NULLIF(state_item->>''report_concept_key'', ''''),\n      COALESCE(state_item->''report_structure_facets'', ''[]''::jsonb),\n      NULLIF(state_item->>''report_rule_key'', ''''),\n      COALESCE((state_item->>''report_covered'')::boolean, false),\n      COALESCE((state_item->>''report_within_target'')::boolean, false),\n      COALESCE((state_item->>''report_fluent'')::boolean, false),\n      COALESCE((state_item->>''report_mastered'')::boolean, false),\n      COALESCE((state_item->>''report_review_due'')::boolean, false),\n      COALESCE((state_item->>''report_stable'')::boolean, false)\n    )\n    ON CONFLICT (user_id, signature) DO UPDATE SET';
  old_updates constant text :=
    E'      remediation_correct_count = EXCLUDED.remediation_correct_count,\n      applied_revision = EXCLUDED.applied_revision';
  new_updates constant text :=
    E'      remediation_correct_count = EXCLUDED.remediation_correct_count,\n      applied_revision = EXCLUDED.applied_revision,\n      report_facets_version = EXCLUDED.report_facets_version,\n      report_concept_key = EXCLUDED.report_concept_key,\n      report_structure_facets = EXCLUDED.report_structure_facets,\n      report_rule_key = EXCLUDED.report_rule_key,\n      report_covered = EXCLUDED.report_covered,\n      report_within_target = EXCLUDED.report_within_target,\n      report_fluent = EXCLUDED.report_fluent,\n      report_mastered = EXCLUDED.report_mastered,\n      report_review_due = EXCLUDED.report_review_due,\n      report_stable = EXCLUDED.report_stable';
  call_statement constant text :=
    '  result := public.settle_calc_session_without_report_projection(p_payload);';
  return_statement constant text := '  RETURN result;';
  call_position integer;
  return_position integer;
BEGIN
  definition := pg_get_functiondef(base_function);
  IF (length(definition) - length(replace(definition, old_columns, ''))) / length(old_columns) <> 1
     OR (length(definition) - length(replace(definition, old_values, ''))) / length(old_values) <> 1
     OR (length(definition) - length(replace(definition, old_updates, ''))) / length(old_updates) <> 1 THEN
    RAISE EXCEPTION 'unexpected calc settlement base definition';
  END IF;
  definition := replace(definition, old_columns, new_columns);
  definition := replace(definition, old_values, new_values);
  definition := replace(definition, old_updates, new_updates);
  EXECUTE definition;

  definition := pg_get_functiondef(wrapper_function);
  call_position := position(call_statement IN definition);
  return_position := position(return_statement IN definition);
  IF call_position = 0 OR return_position <= call_position
     OR position('FOR state_item IN SELECT value' IN definition) = 0 THEN
    RAISE EXCEPTION 'unexpected calc settlement wrapper definition';
  END IF;
  definition := left(definition, call_position - 1)
    || call_statement || E'\n\n'
    || substring(definition FROM return_position);
  definition := replace(definition, E'  state_item jsonb;\n', '');
  definition := replace(definition, E'  result_revision bigint;\n', '');
  EXECUTE definition;
END;
$migration$;
