import type { MixedOp } from '@rosie/core'
import {
  calculateAllCoverage,
  calculateConceptCoverage,
  finiteCoverageUniverses,
  type BlockCoverage,
  type ConceptCoverage,
} from './calc-coverage'
import { decodeSnapshotBits, type CurriculumSnapshotMap } from './calc-curriculum-snapshot'
import type { BlockProgression } from './calc-progression'
import {
  mixedStructureModels,
  structureCoverageModels,
  type StructureCoverage,
} from './calc-structure-coverage'
import { CALC_RULE_DEFINITIONS, type RuleCoverage } from './calc-rule-coverage'
import type { CalcBlockSummary, CalcReportSummaryResponse } from './calc-server-read-contract'

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

export type CalcReportTab = 'overview' | 'coverage' | 'weakness'

export function reportReadScope(tab: CalcReportTab) {
  return {
    loadProblemStates: tab === 'weakness',
    loadSessionDetails: tab !== 'coverage',
    loadMistakes: tab !== 'coverage',
  }
}

export function reportSnapshotMap(summary: CalcReportSummaryResponse): CurriculumSnapshotMap {
  const snapshots: CurriculumSnapshotMap = new Map()
  for (const block of summary.blocks) {
    if (!block.coveredBits || !block.withinTargetBits || !block.fluentBits || !block.masteredBits)
      continue
    snapshots.set(block.blockId, {
      blockId: block.blockId,
      version: block.curriculumVersion,
      universeSize: block.universeSize,
      covered: decodeSnapshotBits(block.coveredBits, block.universeSize),
      withinTarget: decodeSnapshotBits(block.withinTargetBits, block.universeSize),
      fluent: decodeSnapshotBits(block.fluentBits, block.universeSize),
      mastered: decodeSnapshotBits(block.masteredBits, block.universeSize),
      updatedAt: '',
    })
  }
  return snapshots
}

export function reportBlockCoverage(summary: CalcReportSummaryResponse): BlockCoverage[] {
  const blocks = calculateAllCoverage(new Map(), reportSnapshotMap(summary))
  const byId = new Map(summary.blocks.map((block) => [block.blockId, block]))
  return blocks.map((block) => {
    const server = byId.get(block.blockId)
    return server ? { ...block, reviewDue: server.reviewDueCount } : block
  })
}

export function reportConceptCoverage(
  summary: CalcReportSummaryResponse,
): Map<string, ConceptCoverage> {
  const rows = new Map(summary.concepts.map((item) => [item.blockId, item]))
  return new Map(
    finiteCoverageUniverses().map((universe) => {
      const total = calculateConceptCoverage(universe, new Map()).totalConcepts
      const row = rows.get(universe.blockId)
      return [
        universe.blockId,
        {
          blockId: universe.blockId,
          totalConcepts: total,
          coveredConcepts: row?.covered ?? 0,
          withinTargetConcepts: row?.withinTarget ?? 0,
          fluentConcepts: row?.fluent ?? 0,
          masteredConcepts: row?.mastered ?? 0,
          reviewDueConcepts: row?.reviewDue ?? 0,
        },
      ]
    }),
  )
}

export function reportStructureCoverage(
  summary: CalcReportSummaryResponse,
  mixedOps: MixedOp[],
): StructureCoverage[] {
  const rows = new Map(
    summary.structures.map((item) => [`${item.modelId}\u0000${item.cellKey}`, item]),
  )
  return [...structureCoverageModels(), ...mixedStructureModels(mixedOps)].map((model) => {
    const cells = model.cells.map((cell) => {
      const row = rows.get(`${model.id}\u0000${cell.key}`)
      return {
        ...cell,
        covered: row?.covered ?? false,
        fluent: row?.fluent ?? false,
        mastered: row?.mastered ?? false,
        reviewDue: row?.reviewDue ?? false,
        sampleSignatures: row?.sampleSignatures ?? [],
      }
    })
    return {
      id: model.id,
      label: model.label,
      group: model.group,
      version: model.version,
      total: cells.length,
      covered: cells.filter((cell) => cell.covered).length,
      fluent: cells.filter((cell) => cell.fluent).length,
      mastered: cells.filter((cell) => cell.mastered).length,
      reviewDue: cells.filter((cell) => cell.reviewDue).length,
      cells,
    }
  })
}

export function reportRuleCoverage(summary: CalcReportSummaryResponse): RuleCoverage[] {
  const rows = new Map(summary.rules.map((item) => [item.ruleKey, item]))
  return CALC_RULE_DEFINITIONS.map((definition) => {
    const row = rows.get(definition.key)
    return {
      ...definition,
      covered: Math.min(definition.target, row?.covered ?? 0),
      mastered: Math.min(definition.target, row?.mastered ?? 0),
      signatures: row?.sampleSignatures ?? [],
    }
  })
}

export function reportBlockProgression(block: CalcBlockSummary): BlockProgression {
  const evaluatedCount = block.universeSize
  const recentAccuracy = ratio(block.recentIndependentCorrect, block.recentIndependentTotal)
  return {
    blockId: block.blockId,
    exposure: ratio(block.coveredCount, evaluatedCount),
    recentAccuracy,
    stableRatio: ratio(block.stableCount, evaluatedCount),
    fluentRatio: ratio(block.fluentCount, evaluatedCount),
    reviewDueRatio: ratio(block.reviewDueCount, evaluatedCount),
    masteredRatio: ratio(block.masteredCount, evaluatedCount),
    stableCount: block.stableCount,
    fluentCount: block.fluentCount,
    evaluatedCount,
    coveredCount: block.coveredCount,
    coverageTotal: evaluatedCount,
    accuracyCorrect: block.recentIndependentCorrect,
    accuracyTotal: block.recentIndependentTotal,
    ready: block.ready,
    recovery: block.recovery,
    reasons: [],
  }
}
