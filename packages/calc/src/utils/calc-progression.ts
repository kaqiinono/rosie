import type { CalcProblemState } from '@rosie/core'
import { calculateBlockCoverage, coverageUniverse, learningStatusOf } from './calc-coverage'
import { calculateStructureCoverage, structureCoverageModels } from './calc-structure-coverage'
import { suggestedTiers, tierOf } from './calc-time-targets'

export const BLOCK_DEPENDENCIES: Record<string, string[]> = {
  'add:20a': ['add:10'],
  'add:20b': ['add:20a'],
  'add:100a': ['add:20b'],
  'add:100b': ['add:100a'],
  'add:100-comp': ['add:20b'],
  'add:1000': ['add:100b'],
  'add:10000': ['add:1000'],
  'sub:20a': ['sub:10'],
  'sub:20b': ['sub:20a'],
  'sub:100a': ['sub:20b'],
  'sub:100b': ['sub:100a'],
  'sub:round': ['sub:100b'],
  'sub:1000': ['sub:100b'],
  'sub:10000': ['sub:1000'],
  'mul:34': ['mul:25'],
  'mul:67': ['mul:34'],
  'mul:89': ['mul:67'],
  'mul:29': ['mul:89'],
  'mul:1012': ['mul:29'],
  'mul:1319': ['mul:1012'],
  'mul:219': ['mul:1319'],
  'mul:2d1d-nc': ['mul:29'],
  'mul:2d1d-c': ['mul:2d1d-nc'],
  'mul:3d1d-nc': ['mul:2d1d-c'],
  'mul:3d1d-c': ['mul:3d1d-nc'],
  'mul:zeros': ['mul:29'],
  'mul:2d': ['mul:2d1d-c'],
  'div:34': ['div:25'],
  'div:69': ['div:34'],
  'div:29': ['div:69'],
  'div:1012': ['div:29'],
  'div:1319': ['div:1012'],
  'div:219': ['div:1319'],
  'div:multi': ['div:29'],
  'div:2d1d-borrow': ['div:multi'],
  'div:zeros': ['div:29'],
  'div:rem': ['div:29'],
  'dec:add2': ['dec:add1'],
  'dec:mulInt': ['dec:add1', 'mul:29'],
  'dec:divInt': ['dec:add1', 'div:29'],
  'frac:add-diff': ['frac:add-same'],
  'frac:mul-int': ['frac:add-same', 'mul:29'],
  'frac:mul-frac': ['frac:mul-int'],
  'frac:div-int': ['frac:add-same', 'div:29'],
  'frac:div-frac': ['frac:div-int', 'frac:mul-frac'],
}

export interface BlockProgression {
  blockId: string
  exposure: number
  recentAccuracy: number
  stableRatio: number
  fluentRatio: number
  reviewDueRatio: number
  stableCount: number
  fluentCount: number
  evaluatedCount: number
  coveredCount: number
  coverageTotal: number
  accuracyCorrect: number
  accuracyTotal: number
  ready: boolean
  recovery: boolean
  reasons: string[]
}

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

export function evaluateBlockProgression(
  blockId: string,
  states: Map<string, CalcProblemState>,
): BlockProgression {
  const matching = [...states.values()].filter((state) => state.blockId === blockId)
  const finite = coverageUniverse(blockId)
  const structure = structureCoverageModels().find((model) => model.id === blockId)
  const coverage = finite
    ? calculateBlockCoverage(finite, states)
    : structure
      ? calculateStructureCoverage(structure, matching)
      : null
  const exposure = coverage
    ? ratio(coverage.covered, coverage.total)
    : matching.length >= 30
      ? 1
      : matching.length / 30
  const recentSessionNos = [
    ...new Set(
      matching.flatMap((state) =>
        state.recentResults.map((a) => a.sessionNo).filter((n): n is number => n !== undefined),
      ),
    ),
  ]
    .sort((a, b) => b - a)
    .slice(0, 3)
  const recent = matching
    .flatMap((state) => state.recentResults)
    .filter(
      (attempt) => attempt.sessionNo === undefined || recentSessionNos.includes(attempt.sessionNo),
    )
  const independent = recent.filter((attempt) => attempt.evidenceKind !== 'makeup')
  const recentAccuracy = ratio(
    independent.filter((attempt) => attempt.correct).length,
    independent.length,
  )
  const accuracyCorrect = independent.filter((attempt) => attempt.correct).length
  const target = suggestedTiers(blockId)
  let stable = 0
  let fluent = 0
  for (const state of matching) {
    const correct = state.recentResults
      .filter((a) => a.correct && a.evidenceKind !== 'makeup')
      .slice(-5)
    if (correct.length === 0) continue
    const times = correct.map((a) => a.timeMs).sort((a, b) => a - b)
    const medianSec = times[Math.floor(times.length / 2)] / 1000
    const accuracy = ratio(correct.filter((a) => a.correct).length, correct.length)
    const tier = tierOf(medianSec, accuracy, target)
    if (tier === 'stable' || tier === 'fluent' || tier === 'auto') stable++
    if (tier === 'fluent' || tier === 'auto') fluent++
  }
  const stableRatio = ratio(stable, matching.length)
  const fluentRatio = ratio(fluent, matching.length)
  const reviewDueRatio = ratio(
    matching.filter((state) => learningStatusOf(state) === 'review-due').length,
    matching.length,
  )
  const reasons: string[] = []
  if (exposure < 0.9) reasons.push(`覆盖率${Math.round(exposure * 100)}%＜90%`)
  if (recentAccuracy < 0.85)
    reasons.push(`近3场首答正确率${Math.round(recentAccuracy * 100)}%＜85%`)
  const minimumFor = (target: number) => Math.ceil(matching.length * target)
  const formatProgress = (value: number, count: number, target: number) =>
    `当前 ${(value * 100).toFixed(1)}%（${count}/${matching.length}），目标 ${(target * 100).toFixed(0)}%（至少 ${minimumFor(target)}/${matching.length}）`
  if (stableRatio < 0.75) reasons.push(`进阶达标率：${formatProgress(stableRatio, stable, 0.75)}`)
  if (fluentRatio < 0.6) reasons.push(`高级达标率：${formatProgress(fluentRatio, fluent, 0.6)}`)
  const ready = reasons.length === 0
  const recovery = recent.length > 0 && (recentAccuracy < 0.7 || reviewDueRatio > 0.15)
  return {
    blockId,
    exposure,
    recentAccuracy,
    stableRatio,
    fluentRatio,
    reviewDueRatio,
    stableCount: stable,
    fluentCount: fluent,
    evaluatedCount: matching.length,
    coveredCount: coverage?.covered ?? matching.length,
    coverageTotal: coverage?.total ?? matching.length,
    accuracyCorrect,
    accuracyTotal: independent.length,
    ready,
    recovery,
    reasons,
  }
}

export function progressionFactor(blockId: string, states: Map<string, CalcProblemState>): number {
  const dependencies = BLOCK_DEPENDENCIES[blockId] ?? []
  if (dependencies.length === 0) return 1
  const progress = dependencies.map((id) => evaluateBlockProgression(id, states))
  if (progress.some((item) => item.recovery)) return 0.1
  return progress.every((item) => item.ready) ? 1 : 0.2
}

export function suggestedSuccessors(
  selected: Set<string>,
  states: Map<string, CalcProblemState>,
): string[] {
  return Object.entries(BLOCK_DEPENDENCIES)
    .filter(
      ([blockId, dependencies]) =>
        !selected.has(blockId) &&
        dependencies.every((id) => selected.has(id) && evaluateBlockProgression(id, states).ready),
    )
    .map(([blockId]) => blockId)
}
