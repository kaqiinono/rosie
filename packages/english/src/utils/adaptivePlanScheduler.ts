import { isUnfinishedSameDayActivation } from './adaptivePlanBoxes'
import type {
  AdaptivePlanMode,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from './adaptivePlanTypes'

export type AdaptiveDailyTask = {
  mode: AdaptivePlanMode
  /** Due today (nextReviewDate <= today). */
  reviewKeys: string[]
  reviewBatchKeys: string[]
  activateKeys: string[]
  bossKeys: string[]
}

const BOSS_PACK_LIMIT_FALLBACK = 50

function bossPackLimit(plan: AdaptiveWordPlan): number {
  const n = plan.bossPackLimit
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : BOSS_PACK_LIMIT_FALLBACK
}

/** Active rows only — excludes soft-archived progress. */
function activeRows(rows: AdaptivePlanWordProgress[]): AdaptivePlanWordProgress[] {
  return rows.filter(row => row.archivedAt == null)
}

/** Due = LEARNING && nextReviewDate != null && nextReviewDate <= today (lexicographic DATE strings). */
export function isDue(row: AdaptivePlanWordProgress, today: string): boolean {
  return (
    row.status === 'LEARNING' &&
    row.nextReviewDate != null &&
    row.nextReviewDate <= today
  )
}

export function countDueLearning(rows: AdaptivePlanWordProgress[], today: string): number {
  return activeRows(rows).filter(row => isDue(row, today)).length
}

/** §5.2.2 priority: PENDING target 3 → PENDING target 1 → NOT_STARTED. */
export function pickActivations(
  rows: AdaptivePlanWordProgress[],
  n: number,
): AdaptivePlanWordProgress[] {
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  if (limit <= 0) return []

  const pending3 = activeRows(rows).filter(
    row => row.status === 'LEARNING_PENDING' && row.targetBox === 3,
  )
  const pending1 = activeRows(rows).filter(
    row => row.status === 'LEARNING_PENDING' && row.targetBox === 1,
  )
  const notStarted = activeRows(rows).filter(row => row.status === 'NOT_STARTED')

  const picked: AdaptivePlanWordProgress[] = []
  for (const pool of [pending3, pending1, notStarted]) {
    for (const row of pool) {
      if (picked.length >= limit) return picked
      picked.push(row)
    }
  }
  return picked
}

/** Words already activated today — they consume the daily new-word quota (§4.3). */
export function countActivatedToday(
  rows: AdaptivePlanWordProgress[],
  today: string,
): number {
  return activeRows(rows).filter(row => row.introducedOn === today).length
}

function countStubbornLearning(rows: AdaptivePlanWordProgress[]): number {
  return activeRows(rows).filter(
    row => row.status === 'LEARNING' && row.streakWrong >= 2,
  ).length
}

function isQuantitativeBossTrigger(plan: AdaptiveWordPlan): boolean {
  // Require real progress — a brand-new plan (0 activated) must never enter Boss.
  const sinceBoss =
    plan.stats.totalActivatedCount - plan.stats.lastBossActivatedCount
  return (
    plan.stats.totalActivatedCount > 0 &&
    plan.bossEveryNNew > 0 &&
    sinceBoss >= plan.bossEveryNNew
  )
}

function isQualitativeBossTrigger(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
): boolean {
  return countStubbornLearning(rows) >= plan.bossStubbornThreshold
}

export function resolveMode(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): AdaptivePlanMode {
  if (
    plan.mode === 'boss' ||
    isQuantitativeBossTrigger(plan) ||
    isQualitativeBossTrigger(plan, rows)
  ) {
    return 'boss'
  }

  if (countDueLearning(rows, today) > plan.backlogFuse) {
    return 'review_only'
  }

  return 'normal'
}

function compareDateStrings(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a.localeCompare(b)
}

/** Soonest due first for review pool. */
function sortDueReviews(
  rows: AdaptivePlanWordProgress[],
): AdaptivePlanWordProgress[] {
  return [...rows].sort(
    (a, b) => compareDateStrings(a.nextReviewDate, b.nextReviewDate),
  )
}

/** Boss pack: high streakWrong, soonest nextReviewDate, then recently introduced. */
function sortBossCandidates(
  rows: AdaptivePlanWordProgress[],
): AdaptivePlanWordProgress[] {
  return [...rows].sort((a, b) => {
    if (b.streakWrong !== a.streakWrong) {
      return b.streakWrong - a.streakWrong
    }
    const dateCmp = compareDateStrings(a.nextReviewDate, b.nextReviewDate)
    if (dateCmp !== 0) return dateCmp
    // Recently introduced wins ties (descending introducedOn).
    return compareDateStrings(b.introducedOn, a.introducedOn)
  })
}

function pickDueReviewKeys(
  rows: AdaptivePlanWordProgress[],
  today: string,
  reviewCap: number,
): string[] {
  const due = sortDueReviews(activeRows(rows).filter(row => isDue(row, today)))
  return due.slice(0, reviewCap).map(row => row.wordKey)
}

function pickBossKeys(rows: AdaptivePlanWordProgress[], limit: number): string[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : BOSS_PACK_LIMIT_FALLBACK
  const learning = activeRows(rows).filter(row => row.status === 'LEARNING')
  return sortBossCandidates(learning)
    .slice(0, cap)
    .map(row => row.wordKey)
}

export function buildDailyTask(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): AdaptiveDailyTask {
  const mode = resolveMode(plan, rows, today)
  // New words activated earlier today but never settled (child left mid-round)
  // must stay on today's plate — preferably as activateKeys so study → 闯关
  // runs again, not buried as "due tomorrow".
  const unfinishedKeys = activeRows(rows)
    .filter((row) => isUnfinishedSameDayActivation(row, today))
    .map((row) => row.wordKey)
  const unfinishedSet = new Set(unfinishedKeys)
  const dueReviewKeys = pickDueReviewKeys(rows, today, plan.reviewCap).filter(
    (key) => !unfinishedSet.has(key),
  )

  if (mode === 'boss') {
    return {
      mode,
      reviewKeys: dueReviewKeys,
      reviewBatchKeys: dueReviewKeys.slice(0, plan.reviewBatchSize),
      activateKeys: [],
      bossKeys: pickBossKeys(rows, bossPackLimit(plan)),
    }
  }

  if (mode === 'review_only') {
    // Can't pull brand-new words, but unfinished same-day activations still need practice.
    const reviewKeys = [...unfinishedKeys, ...dueReviewKeys].slice(0, plan.reviewCap)
    return {
      mode,
      reviewKeys,
      reviewBatchKeys: reviewKeys.slice(0, plan.reviewBatchSize),
      activateKeys: [],
      bossKeys: [],
    }
  }

  // newWordsPerDay is a per-round batch size + daily *goal*, not a hard ceiling.
  // After today's goal is met, another round can still pull a fresh batch so the
  // child can get ahead (提前学). Unfinished mid-round activations fill the
  // batch first so「开始」resumes them instead of piling on more new words.
  const perDay = Number.isFinite(plan.newWordsPerDay) ? plan.newWordsPerDay : 10
  const batchSize = Math.max(1, Math.floor(perDay))
  const freshSlots = Math.max(0, batchSize - unfinishedKeys.length)
  const freshKeys = pickActivations(rows, freshSlots).map((row) => row.wordKey)
  const activateKeys = [...unfinishedKeys, ...freshKeys]

  // Reviews are due-date only — never pull future-box words forward on idle days
  // (that collapses Leitner intervals, e.g. Box5 7-day gap).
  return {
    mode,
    reviewKeys: dueReviewKeys,
    reviewBatchKeys: dueReviewKeys.slice(0, plan.reviewBatchSize),
    activateKeys,
    bossKeys: [],
  }
}

/**
 * Homepage / today-card progress for an adaptive plan's **mandatory** daily work.
 *
 * - New-word progress: settled activations today (「开始」but not settled → 0).
 * - Due reviews / Boss pack count toward `total` until cleared, so the card never
 *   shows e.g. 5/5 while reviews remain (done + remaining === total).
 * - Meeting the goal does not block 提前学; `allDone` ignores ahead batches.
 */
export function summarizeAdaptiveTodayProgress(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): {
  done: number
  total: number
  allDone: boolean
  activateCount: number
  reviewCount: number
  unfinishedCount: number
  subtitle: string
} {
  const perDay = Number.isFinite(plan.newWordsPerDay) ? plan.newWordsPerDay : 10
  const newGoal = Math.max(1, Math.floor(perDay))
  const unfinishedCount = activeRows(rows).filter((row) =>
    isUnfinishedSameDayActivation(row, today),
  ).length
  const activated = countActivatedToday(rows, today)
  const settled = Math.max(0, activated - unfinishedCount)
  const task = buildDailyTask(plan, rows, today)
  const goalMet = settled >= newGoal && unfinishedCount === 0
  // Goal met + no mandatory review/boss work. Extra activateKeys (提前学) do
  // not keep the card in an incomplete state.
  const allDone =
    goalMet &&
    unfinishedCount === 0 &&
    task.reviewKeys.length === 0 &&
    task.mode !== 'boss'

  const newDone = Math.min(newGoal, settled)
  const newRemaining = Math.max(0, newGoal - newDone)
  const dueRemaining =
    task.mode === 'boss' ? task.bossKeys.length : task.reviewKeys.length

  // When finished, show the new-word goal as the completed quota. While work
  // remains, keep done + remaining === total (reviews inflate the denominator).
  const done = allDone ? newGoal : newDone
  const total = allDone ? newGoal : newDone + newRemaining + dueRemaining

  const canAhead = allDone && task.activateKeys.length > 0

  let subtitle: string
  if (canAhead) {
    subtitle = '今日目标已完成，可提前继续学'
  } else if (allDone) {
    subtitle = '今日任务已完成'
  } else if (unfinishedCount > 0) {
    subtitle = `还有 ${unfinishedCount} 个新词待练完`
  } else if (task.mode === 'boss') {
    subtitle = `Boss 挑战 · ${task.bossKeys.length} 词`
  } else {
    subtitle = `今日新学 ${task.activateKeys.length} · 复习 ${task.reviewKeys.length}`
  }

  return {
    done,
    total,
    allDone,
    activateCount: task.activateKeys.length,
    reviewCount: task.reviewKeys.length,
    unfinishedCount,
    subtitle,
  }
}

/** §5.7 — completable when no active learning pipeline and no open session. */
export function isPlanCompletable(
  rows: AdaptivePlanWordProgress[],
  hasOpenSession: boolean,
): boolean {
  if (hasOpenSession) return false

  const active = activeRows(rows)
  return !active.some(
    row =>
      row.status === 'NOT_STARTED' ||
      row.status === 'LEARNING_PENDING' ||
      row.status === 'LEARNING',
  )
}
