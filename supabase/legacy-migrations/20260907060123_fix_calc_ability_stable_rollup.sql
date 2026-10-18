-- Stable progression for ability curricula is an any-formula-per-cell fact,
-- not a count of stable formulas. Return the deduplicated bounded cell set.
CREATE OR REPLACE FUNCTION public.get_calc_structure_stability()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH structure_cells AS (
    SELECT facet->>'modelId' AS model_id, cell.value AS cell_key,
      state.report_stable AS stable
    FROM public.calc_problem_state AS state
    CROSS JOIN LATERAL jsonb_array_elements(state.report_structure_facets) AS facet
    CROSS JOIN LATERAL jsonb_array_elements_text(facet->'cellKeys') AS cell(value)
    WHERE state.user_id = auth.uid() AND state.report_facets_version = 1
  ), stable_cells AS (
    SELECT model_id, cell_key
    FROM structure_cells
    GROUP BY model_id, cell_key
    HAVING bool_or(stable)
  )
  SELECT jsonb_build_object(
    'revision', COALESCE((SELECT state_revision FROM public.calc_user_runtime
      WHERE user_id = auth.uid()), 0),
    'cells', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'modelId', model_id, 'cellKey', cell_key
    ) ORDER BY model_id, cell_key) FROM stable_cells), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_calc_structure_stability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calc_structure_stability() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_calc_structure_stability() TO authenticated;
