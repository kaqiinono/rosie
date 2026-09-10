import type { QuizType, WordEntry, WordMasteryInfo, WordMasteryMap, WeeklyPlan } from '@rosie/core'
import { advanceStage, regressStage } from '@rosie/core'
import { applyBoxAnswer } from './adaptivePlanBoxes'
import type { AdaptivePlanStats, AdaptivePlanWordProgress } from './adaptivePlanTypes'
import { classifyPlanWords } from './english-helpers'

export type SessionOutcome = {
  wordKey: string
  correct: boolean
  quizType?: QuizType
  usedRetry?: boolean
  usedHelp?: boolean
  usedHelpCount?: number
}

/** Any retry or help makes the answer assisted, regardless of question type. */
export function isIndependentCorrectOutcome(result: SessionOutcome): boolean {
  if (!result.correct) return false
  return result.usedRetry !== true && result.usedHelp !== true
}

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

/** Keys that were answered wrong at least once during the session. */
export function wrongOnceKeys(results: SessionOutcome[]): Set<string> {
  const s = new Set<string>()
  for (const r of results) if (!r.correct) s.add(r.wordKey)
  return s
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
  return row.status === 'MASTERED' ||
    (row.status === 'LEARNING' && row.boxIndex !== null && row.boxIndex >= 3 && row.boxIndex < 5)
}

function buildMasteryPatches(
  collapsed: Map<string, boolean>,
  progressByKey: Map<string, AdaptivePlanWordProgress>,
  masteryByKey: WordMasteryMap,
  consolidateExemptSet: Set<string>,
  today: string,
  blockedAdvanceKeys: Set<string> = new Set(),
): AdaptiveMasteryPatch[] {
  const patches: AdaptiveMasteryPatch[] = []

  for (const [wordKey, finalCorrect] of collapsed) {
    const row = progressByKey.get(wordKey)
    if (!row) continue

    const cur = masteryByKey[wordKey] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const shouldAdvance =
      finalCorrect && !blockedAdvanceKeys.has(wordKey) && shouldAdvanceMastery(row)
    const shouldRegress =
      !finalCorrect && row.streakWrong >= 2 && !consolidateExemptSet.has(wordKey)

    // Stamp lastSeen: the word was just practiced, and a brand-new mastery
    // record starts with lastSeen '' which Postgres rejects for the DATE column.
    if (shouldAdvance) {
      patches.push({ wordKey, info: { ...advanceStage(cur, today, wordKey), lastSeen: today } })
    } else if (shouldRegress) {
      patches.push({ wordKey, info: { ...regressStage(cur, today), lastSeen: today } })
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

/**
 * Step3打卡成功：批量更新计划箱 + 全局 mastery。
 *
 * 只有全程独立正确才升阶。任一答错、重试或提示都会保留当前阶段，
 * 并增加弱词计数，下一批主线优先验收。全局 mastery 同样不会因辅助答对而升级。
 */
export function settleStep3(args: SettleStep3Args): SettleResult {
  const { progressRows, results, masteryByKey, consolidateExemptSet, today } = args
  const collapsed = collapseSessionOutcomes(results)
  const blockedAdvanceKeys = new Set(
    results.filter((result) => !isIndependentCorrectOutcome(result)).map((result) => result.wordKey),
  )
  const byKey = progressMap(progressRows)

  for (const wordKey of collapsed.keys()) {
    const row = byKey.get(wordKey)
    if (!row) continue
    if (blockedAdvanceKeys.has(wordKey)) {
      byKey.set(wordKey, {
        ...row,
        // V2 keeps a failed word at its current stage. It receives priority in
        // the next main-line batch instead of falling back to Stage 1.
        streakWrong: row.streakWrong + 1,
        nextReviewDate: null,
      })
    } else {
      byKey.set(wordKey, applyBoxAnswer(row, true, today))
    }
  }

  const progressUpdates = [...collapsed.keys()]
    .map(k => byKey.get(k))
    .filter((r): r is AdaptivePlanWordProgress => r != null)

  return {
    progressUpdates,
    masteryPatches: buildMasteryPatches(
      collapsed,
      byKey,
      masteryByKey,
      consolidateExemptSet,
      today,
      blockedAdvanceKeys,
    ),
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
  bossPassed: boolean
}

function buildBossPlanStatsPatch(
  stats: AdaptivePlanStats,
  firstPassResults: SessionOutcome[],
  sinkResults: SessionOutcome[],
): Partial<AdaptivePlanStats> {
  const total = firstPassResults.length
  if (total === 0) return {}

  const correct = firstPassResults.filter(isIndependentCorrectOutcome).length
  const firstPassPct = (correct / total) * 100
  const latestSinkOutcomes = new Map<string, SessionOutcome>()
  for (const result of sinkResults) latestSinkOutcomes.set(result.wordKey, result)
  const sinkCleared =
    latestSinkOutcomes.size === 0 ||
    [...latestSinkOutcomes.values()].every(isIndependentCorrectOutcome)

  if (firstPassPct >= 85 && sinkCleared) {
    return { bossFailStreak: 0 }
  }

  // Failure keeps the frozen Boss cohort intact. Formal Boss difficulty never downgrades.
  return {
    bossFailStreak: stats.bossFailStreak + 1,
  }
}

/** Boss settlement: pass graduates the frozen cohort; failure keeps it frozen. */
export function settleBossFirstPass(args: SettleBossFirstPassArgs): SettleResult {
  const {
    progressRows,
    firstPassResults,
    sinkResults = [],
    masteryByKey,
    consolidateExemptSet,
    currentStats,
    today,
    bossPassed,
  } = args

  const byKey = progressMap(progressRows)

  const collapsedFirstPass = collapseSessionOutcomes(firstPassResults)
  for (const wordKey of collapsedFirstPass.keys()) {
    const row = byKey.get(wordKey)
    if (!row) continue
    byKey.set(wordKey, bossPassed
      ? { ...row, status: 'MASTERED', boxIndex: null, targetBox: null, streakWrong: 0, nextReviewDate: null }
      : { ...row, status: 'LEARNING_PENDING', boxIndex: 5, targetBox: null, nextReviewDate: null })
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
    masteryPatches: buildMasteryPatches(
      collapsed,
      byKey,
      masteryByKey,
      consolidateExemptSet,
      today,
      new Set(),
    ),
    planStatsPatch: buildBossPlanStatsPatch(currentStats, firstPassResults, sinkResults),
  }
}
