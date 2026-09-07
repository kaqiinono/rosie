import type { CalcProblemState } from '@rosie/core'
import { parseSignature, type AstNode } from './calc-ast'
import { conceptKeyOf } from './calc-concept-key'
import { coverageUniverse, learningStatusOf } from './calc-coverage'
import { hasIndependentAttempt, hasWithinTargetAttempt } from './calc-evidence'
import { classifyRuleSignature } from './calc-rule-coverage'
import { structureCoverageModels } from './calc-structure-coverage'
import { statePerformanceTier } from './calc-progression'

export const CALC_REPORT_FACETS_VERSION = 1

export interface CalcReportStructureFacet {
  modelId: string
  cellKeys: string[]
}

export interface CalcReportFacets {
  version: typeof CALC_REPORT_FACETS_VERSION
  conceptKey: string | null
  structures: CalcReportStructureFacet[]
  ruleKey: string | null
}

function astDepth(node: AstNode): number {
  if (typeof node === 'number') return 0
  return 1 + Math.max(astDepth(node.left), astDepth(node.right))
}

function mixedCellKeys(signature: string): string[] {
  try {
    const ast = parseSignature(signature)
    if (typeof ast === 'number') return []
    return [
      ast.op === 'add' || ast.op === 'sub' ? 'root:addsub' : 'root:muldiv',
      astDepth(ast) >= 3 ? 'depth:3' : 'depth:2',
    ]
  } catch {
    return []
  }
}

/** Stable classification stored with each problem state for bounded report aggregation. */
export function reportFacetsOf(state: CalcProblemState): CalcReportFacets {
  const structures: CalcReportStructureFacet[] = []
  if (state.blockId) {
    const model = structureCoverageModels().find((candidate) => candidate.id === state.blockId)
    const cellKeys = model?.classify(state.signature) ?? []
    if (model && cellKeys.length > 0) structures.push({ modelId: model.id, cellKeys })
  }
  if (state.mixedOpId) {
    const cellKeys = mixedCellKeys(state.signature)
    if (cellKeys.length > 0) structures.push({ modelId: `mixed:${state.mixedOpId}`, cellKeys })
  }
  return {
    version: CALC_REPORT_FACETS_VERSION,
    conceptKey:
      state.blockId && coverageUniverse(state.blockId) ? conceptKeyOf(state.signature) : null,
    structures,
    ruleKey: classifyRuleSignature(state.signature),
  }
}

export function reportEvidenceOf(state: CalcProblemState) {
  const status = learningStatusOf(state)
  const performanceTier = state.blockId ? statePerformanceTier(state.blockId, state) : null
  return {
    covered: hasIndependentAttempt(state),
    withinTarget: hasWithinTargetAttempt(state),
    fluent: status === 'fluent' || status === 'mastered',
    mastered: status === 'mastered',
    reviewDue: status === 'review-due',
    stable:
      performanceTier === 'stable' || performanceTier === 'fluent' || performanceTier === 'auto',
  }
}

export function reportFieldsOf(state: CalcProblemState) {
  const facets = reportFacetsOf(state)
  const evidence = reportEvidenceOf(state)
  return {
    report_facets_version: facets.version,
    report_concept_key: facets.conceptKey,
    report_structure_facets: facets.structures,
    report_rule_key: facets.ruleKey,
    report_covered: evidence.covered,
    report_within_target: evidence.withinTarget,
    report_fluent: evidence.fluent,
    report_mastered: evidence.mastered,
    report_review_due: evidence.reviewDue,
    report_stable: evidence.stable,
  }
}
