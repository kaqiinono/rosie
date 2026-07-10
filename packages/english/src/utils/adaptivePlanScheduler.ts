import type {
  AdaptivePlanMode,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from './adaptivePlanTypes'

export type AdaptiveDailyTask = {
  mode: AdaptivePlanMode
  reviewKeys: string[]
  reviewBatchKeys: string[]
  activateKeys: string[]
  bossKeys: string[]
}

const BOSS_PACK_LIMIT = 50

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

function pickBossKeys(rows: AdaptivePlanWordProgress[]): string[] {
  const learning = activeRows(rows).filter(row => row.status === 'LEARNING')
  return sortBossCandidates(learning)
    .slice(0, BOSS_PACK_LIMIT)
    .map(row => row.wordKey)
}

export function buildDailyTask(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): AdaptiveDailyTask {
  const mode = resolveMode(plan, rows, today)
  const reviewKeys = pickDueReviewKeys(rows, today, plan.reviewCap)
  const reviewBatchKeys = reviewKeys.slice(0, plan.reviewBatchSize)

  if (mode === 'boss') {
    return {
      mode,
      reviewKeys,
      reviewBatchKeys,
      activateKeys: [],
      bossKeys: pickBossKeys(rows),
    }
  }

  if (mode === 'review_only') {
    return {
      mode,
      reviewKeys,
      reviewBatchKeys,
      activateKeys: [],
      bossKeys: [],
    }
  }

  // §4.3: newWordsPerDay is a PER-DAY quota. Same-day repeat rounds must not
  // pull a fresh batch each time — deduct words already introduced today.
  const perDay = Number.isFinite(plan.newWordsPerDay) ? plan.newWordsPerDay : 10
  const remainingToday = Math.max(0, perDay - countActivatedToday(rows, today))

  return {
    mode,
    reviewKeys,
    reviewBatchKeys,
    activateKeys: pickActivations(rows, remainingToday).map(row => row.wordKey),
    bossKeys: [],
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
