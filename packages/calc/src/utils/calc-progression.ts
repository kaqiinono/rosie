import type { CalcMixingStage, CalcProblemState, CalcSession } from '@rosie/core'
import { calculateBlockCoverage, coverageUniverse, learningStatusOf } from './calc-coverage'
import { calculateStructureCoverage, structureCoverageModels } from './calc-structure-coverage'
import { presentationCoefficientFor, suggestedTiers, tierOf } from './calc-time-targets'
import { isIndependentEvidence } from './calc-evidence'

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
  masteredRatio: number
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
  const finite = coverageUniverse(blockId)
  const structure = structureCoverageModels().find((model) => model.id === blockId)
  const matching = finite
    ? Array.from({ length: finite.size }, (_, index) => states.get(finite.signatureAt(index))).filter(
        (state): state is CalcProblemState => state !== undefined,
      )
    : [...states.values()].filter((state) => state.blockId === blockId)
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
  // 独立首答：排除补练与间隔复习（旧数据无 evidenceKind 标记时仍计入）
  const independent = recent.filter(
    isIndependentEvidence,
  )
  const recentAccuracy = ratio(
    independent.filter((attempt) => attempt.correct).length,
    independent.length,
  )
  const accuracyCorrect = independent.filter((attempt) => attempt.correct).length
  const target = suggestedTiers(blockId)
  let stable = 0
  let fluent = 0
  for (const state of matching) {
    const independentAttempts = state.recentResults.filter(isIndependentEvidence).slice(-5)
    const correct = independentAttempts.filter((attempt) => attempt.correct)
    if (correct.length === 0) continue
    const times = correct
      .map(
        (attempt) =>
          attempt.timeMs / presentationCoefficientFor(blockId, attempt.presentationKey),
      )
      .sort((a, b) => a - b)
    const medianSec = times[Math.floor(times.length / 2)] / 1000
    const accuracy = ratio(correct.length, independentAttempts.length)
    const tier = tierOf(medianSec, accuracy, target)
    if (tier === 'stable' || tier === 'fluent' || tier === 'auto') stable++
    if (tier === 'fluent' || tier === 'auto') fluent++
  }
  const evaluatedTotal = finite?.size ?? matching.length
  const stableRatio = ratio(stable, evaluatedTotal)
  const fluentRatio = ratio(fluent, evaluatedTotal)
  const reviewDueRatio = ratio(
    matching.filter((state) => learningStatusOf(state) === 'review-due').length,
    evaluatedTotal,
  )
  const masteredRatio = ratio(
    matching.filter((state) => learningStatusOf(state) === 'mastered').length,
    evaluatedTotal,
  )
  const reasons: string[] = []
  if (exposure < 0.9) reasons.push(`覆盖率${Math.round(exposure * 100)}%＜90%`)
  if (recentAccuracy < 0.85)
    reasons.push(`近3场首答正确率${Math.round(recentAccuracy * 100)}%＜85%`)
  const minimumFor = (target: number) => Math.ceil(evaluatedTotal * target)
  const formatProgress = (value: number, count: number, target: number) =>
    `当前 ${(value * 100).toFixed(1)}%（${count}/${evaluatedTotal}），目标 ${(target * 100).toFixed(0)}%（至少 ${minimumFor(target)}/${evaluatedTotal}）`
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
    masteredRatio,
    stableCount: stable,
    fluentCount: fluent,
    evaluatedCount: evaluatedTotal,
    coveredCount: coverage?.covered ?? matching.length,
    coverageTotal: coverage?.total ?? matching.length,
    accuracyCorrect,
    accuracyTotal: independent.length,
    ready,
    recovery,
    reasons,
  }
}

/**
 * 回补防抖：统计某题型自最近一次「回补场次」以来的连续正常场次。
 * 正常场 = 该场次中此题型首答正确率 ≥ 0.7；回补场 = 正确率 < 0.7。
 * 返回 null 表示历史里没有回补事件（无需冷却）。
 */
export function recoverySessionCount(
  blockId: string,
  sessions: CalcSession[],
): number | null {
  const key = `block:${blockId}`
  const ordered = [...sessions]
    .filter((s) => Array.isArray(s.questionLog) && s.questionLog.some((e) => e.key === key))
    .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''))
  let normal = 0
  for (const session of ordered) {
    const entries = (session.questionLog ?? []).filter((e) => e.key === key)
    const correct = entries.filter((e) => e.ok).length
    const accuracy = entries.length > 0 ? correct / entries.length : 1
    if (accuracy < 0.7) return normal
    normal++
  }
  return null
}

export function progressionFactor(
  blockId: string,
  states: Map<string, CalcProblemState>,
  sessions?: CalcSession[],
): number {
  const dependencies = BLOCK_DEPENDENCIES[blockId] ?? []
  if (dependencies.length === 0) return 1
  const progress = dependencies.map((id) => evaluateBlockProgression(id, states))
  if (progress.some((item) => item.recovery)) return 0.1
  // 防抖：依赖题型刚恢复（连续正常场 < 2）进入冷却期，避免立刻满权重回补
  if (sessions && sessions.length > 0) {
    const justRecovered = dependencies.some((id) => {
      const n = recoverySessionCount(id, sessions)
      return n !== null && n < 2
    })
    if (justRecovered) return 0.5
  }
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

/** 题型四档评级：entry → stable → fluent → auto */
export type BlockTier = 'entry' | 'stable' | 'fluent' | 'auto'

export function blockTierFromProgression(p: BlockProgression): BlockTier {
  if (p.exposure >= 1.0 && p.masteredRatio >= 0.9 && p.fluentRatio >= 0.8) return 'auto'
  if (p.exposure >= 0.9 && p.stableRatio >= 0.8 && p.fluentRatio >= 0.6) return 'fluent'
  if (p.exposure >= 0.8 && p.stableRatio >= 0.7) return 'stable'
  return 'entry'
}

/** 渐进混合三阶段：维护 / 探索 / 补练比例随题型档位演化 */
export type MixingStage = CalcMixingStage

export interface MixingRatios {
  currentMaintenance: number
  nextExploration: number
  weakReinforcement: number
}

export interface MixingCounts {
  currentMaintenance: number
  nextExploration: number
  weakReinforcement: number
}

export const MIXING_STAGES: Record<MixingStage, MixingRatios> = {
  initial: { currentMaintenance: 0.7, nextExploration: 0.2, weakReinforcement: 0.1 },
  stabilized: { currentMaintenance: 0.6, nextExploration: 0.2, weakReinforcement: 0.2 },
  graduated: { currentMaintenance: 0.5, nextExploration: 0.2, weakReinforcement: 0.3 },
}

/** Integer whole-session allocation using largest remainder; total is always `count`. */
export function allocateMixingCounts(
  count: number,
  ratios: MixingRatios,
  hasSuccessor: boolean,
): MixingCounts {
  const safeCount = Math.max(0, Math.floor(count))
  const effective = hasSuccessor
    ? ratios
    : {
        currentMaintenance: ratios.currentMaintenance + ratios.nextExploration,
        nextExploration: 0,
        weakReinforcement: ratios.weakReinforcement,
      }
  const keys = [
    'currentMaintenance',
    'nextExploration',
    'weakReinforcement',
  ] as const
  const ideals = keys.map((key) => safeCount * effective[key])
  const values = ideals.map(Math.floor)
  let remaining = safeCount - values.reduce((sum, value) => sum + value, 0)
  const order = ideals
    .map((ideal, index) => ({ index, fraction: ideal - Math.floor(ideal) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
  for (let index = 0; remaining > 0; index++, remaining--) {
    values[order[index % order.length].index]++
  }
  return {
    currentMaintenance: values[0],
    nextExploration: values[1],
    weakReinforcement: values[2],
  }
}

export function mixingStageFromProgression(p: BlockProgression): MixingStage {
  const tier = blockTierFromProgression(p)
  if ((tier === 'fluent' || tier === 'auto') && p.masteredRatio >= 0.6) return 'graduated'
  if (tier !== 'entry' && p.recentAccuracy >= 0.8) return 'stabilized'
  return 'initial'
}

export function determineMixingStage(
  blockId: string,
  states: Map<string, CalcProblemState>,
): MixingStage {
  return mixingStageFromProgression(evaluateBlockProgression(blockId, states))
}
