import type { WordEntry, WordMasteryInfo, WordMasteryMap, WeeklyPlan } from '@rosie/core'
import { advanceStage, regressStage } from '@rosie/core'
import { applyBoxAnswer } from './adaptivePlanBoxes'
import type { AdaptivePlanStats, AdaptivePlanWordProgress } from './adaptivePlanTypes'
import { classifyPlanWords } from './english-helpers'

export type SessionOutcome = { wordKey: string; correct: boolean }

export type AdaptiveMasteryPatch = { wordKey: string; info: WordMasteryInfo }

export type SettleResult = {
  progressUpdates: AdaptivePlanWordProgress[]
  masteryPatches: AdaptiveMasteryPatch[]
  planStatsPatch: Partial<AdaptivePlanStats>
}

/** Last write wins within the session list; Step3 results should be appended after Step1. */
export function collapseSessionOutcomes(results: SessionOutcome[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of results) m.set(r.wordKey, r.correct)
  return m
}

/** Keys in the active weekly plan classified as consolidate (§5.6.1 exempt from regress). */
export function buildConsolidateExemptSet(
  activeWeeklyPlan: WeeklyPlan | null | undefined,
  vocab: WordEntry[],
): Set<string> {
  if (!activeWeeklyPlan) return new Set()
  const classified = classifyPlanWords(activeWeeklyPlan, vocab)
  const exempt = new Set<string>()
  for (const [key, kind] of classified) {
    if (kind === 'consolidate') exempt.add(key)
  }
  return exempt
}

function progressMap(rows: AdaptivePlanWordProgress[]): Map<string, AdaptivePlanWordProgress> {
  return new Map(rows.map(r => [r.wordKey, r]))
}

function shouldAdvanceMastery(row: AdaptivePlanWordProgress): boolean {
  return row.status === 'MASTERED' || (row.boxIndex !== null && row.boxIndex >= 3)
}

function buildMasteryPatches(
  collapsed: Map<string, boolean>,
  progressByKey: Map<string, AdaptivePlanWordProgress>,
  masteryByKey: WordMasteryMap,
  consolidateExemptSet: Set<string>,
  today: string,
): AdaptiveMasteryPatch[] {
  const patches: AdaptiveMasteryPatch[] = []

  for (const [wordKey, finalCorrect] of collapsed) {
    const row = progressByKey.get(wordKey)
    if (!row) continue

    const cur = masteryByKey[wordKey] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const shouldAdvance = finalCorrect && shouldAdvanceMastery(row)
    const shouldRegress =
      !finalCorrect && row.streakWrong >= 2 && !consolidateExemptSet.has(wordKey)

    if (shouldAdvance) {
      patches.push({ wordKey, info: advanceStage(cur, today, wordKey) })
    } else if (shouldRegress) {
      patches.push({ wordKey, info: regressStage(cur, today) })
    }
  }

  return patches
}

export type SettleStep3Args = {
  progressRows: AdaptivePlanWordProgress[]
  /** Step1 then Step3 outcomes; collapse before box + mastery writes. */
  results: SessionOutcome[]
  masteryByKey: WordMasteryMap
  consolidateExemptSet: Set<string>
  today: string
}

/** Step3打卡成功：按终态对错批量更新计划箱 + 全局 mastery（§5.6）。 */
export function settleStep3(args: SettleStep3Args): SettleResult {
  const { progressRows, results, masteryByKey, consolidateExemptSet, today } = args
  const collapsed = collapseSessionOutcomes(results)
  const byKey = progressMap(progressRows)

  for (const [wordKey, finalCorrect] of collapsed) {
    const row = byKey.get(wordKey)
    if (!row) continue
    byKey.set(wordKey, applyBoxAnswer(row, finalCorrect, today))
  }

  const progressUpdates = [...collapsed.keys()]
    .map(k => byKey.get(k))
    .filter((r): r is AdaptivePlanWordProgress => r != null)

  return {
    progressUpdates,
    masteryPatches: buildMasteryPatches(collapsed, byKey, masteryByKey, consolidateExemptSet, today),
    planStatsPatch: {},
  }
}

export type SettleBossFirstPassArgs = {
  progressRows: AdaptivePlanWordProgress[]
  /** First-pass answers only — drive box changes. */
  firstPassResults: SessionOutcome[]
  /** Sink clears appended after first pass for mastery collapse only. */
  sinkResults?: SessionOutcome[]
  masteryByKey: WordMasteryMap
  consolidateExemptSet: Set<string>
  currentStats: AdaptivePlanStats
  today: string
}

function buildBossPlanStatsPatch(
  stats: AdaptivePlanStats,
  firstPassResults: SessionOutcome[],
  sinkResults: SessionOutcome[],
): Partial<AdaptivePlanStats> {
  const total = firstPassResults.length
  if (total === 0) return {}

  const correct = firstPassResults.filter(r => r.correct).length
  const firstPassPct = (correct / total) * 100
  const sinkCleared = sinkResults.length === 0 || sinkResults.every(r => r.correct)

  if (firstPassPct >= 85 && sinkCleared) {
    return { bossFailStreak: 0 }
  }

  if (firstPassPct < 60) {
    return {
      bossFailStreak: stats.bossFailStreak + 1,
      bossQuestionTier: Math.min(3, stats.bossQuestionTier + 1),
    }
  }

  return {}
}

/** Boss 交卷：首轮改箱；沉底答对不升箱；mastery 按折叠终态回写（§5.5–5.6）。 */
export function settleBossFirstPass(args: SettleBossFirstPassArgs): SettleResult {
  const {
    progressRows,
    firstPassResults,
    sinkResults = [],
    masteryByKey,
    consolidateExemptSet,
    currentStats,
    today,
  } = args

  const byKey = progressMap(progressRows)

  for (const { wordKey, correct } of firstPassResults) {
    const row = byKey.get(wordKey)
    if (!row) continue
    byKey.set(wordKey, applyBoxAnswer(row, correct, today))
  }

  const touchedKeys = new Set([
    ...firstPassResults.map(r => r.wordKey),
    ...sinkResults.map(r => r.wordKey),
  ])

  const progressUpdates = [...touchedKeys]
    .map(k => byKey.get(k))
    .filter((r): r is AdaptivePlanWordProgress => r != null)

  const collapsed = collapseSessionOutcomes([...firstPassResults, ...sinkResults])

  return {
    progressUpdates,
    masteryPatches: buildMasteryPatches(collapsed, byKey, masteryByKey, consolidateExemptSet, today),
    planStatsPatch: buildBossPlanStatsPatch(currentStats, firstPassResults, sinkResults),
  }
}
