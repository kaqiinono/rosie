import { isUnfinishedSameDayActivation } from './adaptivePlanBoxes'
import type {
  AdaptivePlanMode,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from './adaptivePlanTypes'

export type AdaptiveDailyTask = {
  mode: AdaptivePlanMode
  /** Historical stage words selected for this main-line batch. */
  reviewKeys: string[]
  reviewBatchKeys: string[]
  stageReviewCount: number
  queuedStageCount: number
  activateKeys: string[]
  bossKeys: string[]
  /**
   * Boss mode only: unfinished same-day activations folded into `bossKeys`.
   * The settle counts them toward the daily new-word goal so a passed boss
   * doesn't leave the homepage card at e.g. 20/25 demanding a second round.
   */
  bossUnfinishedNewKeys: string[]
}

/** Active rows only — excludes soft-archived progress. */
function activeRows(rows: AdaptivePlanWordProgress[]): AdaptivePlanWordProgress[] {
  return rows.filter((row) => row.archivedAt == null)
}

/** V2 historical-stage eligibility is batch-based, never date-based. */
export function isDue(row: AdaptivePlanWordProgress, _today: string): boolean {
  return row.status === 'LEARNING'
}

export function countDueLearning(rows: AdaptivePlanWordProgress[], today: string): number {
  return activeRows(rows).filter((row) => isDue(row, today)).length
}

/** §5.2.2 priority: PENDING target 3 → PENDING target 1 → NOT_STARTED. */
export function pickActivations(
  rows: AdaptivePlanWordProgress[],
  n: number,
): AdaptivePlanWordProgress[] {
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  if (limit <= 0) return []

  const pending3 = activeRows(rows).filter(
    (row) => row.status === 'LEARNING_PENDING' && row.targetBox === 3,
  )
  const pending1 = activeRows(rows).filter(
    (row) => row.status === 'LEARNING_PENDING' && row.targetBox === 1,
  )
  const notStarted = activeRows(rows).filter((row) => row.status === 'NOT_STARTED')

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
export function countActivatedToday(rows: AdaptivePlanWordProgress[], today: string): number {
  return activeRows(rows).filter((row) => row.introducedOn === today).length
}

function isQuantitativeBossTrigger(plan: AdaptiveWordPlan): boolean {
  // Require real progress — a brand-new plan (0 activated) must never enter Boss.
  const sinceBoss = plan.stats.totalActivatedCount - plan.stats.lastBossActivatedCount
  return (
    plan.stats.totalActivatedCount > 0 && plan.bossEveryNNew > 0 && sinceBoss >= plan.bossEveryNNew
  )
}

export function isBossPending(row: AdaptivePlanWordProgress): boolean {
  return row.status === 'LEARNING_PENDING' && row.targetBox == null && row.boxIndex === 5
}

export function resolveMode(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): AdaptivePlanMode {
  // Boss never replaces an already-started main-line batch.
  if (activeRows(rows).some((row) => isUnfinishedSameDayActivation(row, today))) {
    return 'normal'
  }
  const hasBossPending = activeRows(rows).some(isBossPending)
  if (
    (plan.mode === 'boss' && hasBossPending) ||
    ((isQuantitativeBossTrigger(plan) ||
      !activeRows(rows).some((row) => row.status === 'NOT_STARTED' || row.status === 'LEARNING')) &&
      hasBossPending)
  ) {
    return 'boss'
  }

  return 'normal'
}

/** Weak words first; otherwise keep activation order stable inside one stage. */
function sortDueReviews(rows: AdaptivePlanWordProgress[]): AdaptivePlanWordProgress[] {
  return [...rows].sort((a, b) => {
    const weak = b.streakWrong - a.streakWrong
    if (weak !== 0) return weak
    const introduced = (a.introducedOn ?? '').localeCompare(b.introducedOn ?? '')
    return introduced !== 0 ? introduced : a.wordKey.localeCompare(b.wordKey)
  })
}

/**
 * Fill the main-line history portion across boxes instead of letting one large high-box
 * bucket occupy every slot.
 */
function interleaveDueReviews(rows: AdaptivePlanWordProgress[]): AdaptivePlanWordProgress[] {
  const queues = ([1, 2, 3, 4, 5] as const).map((box) =>
    sortDueReviews(rows.filter((row) => (row.boxIndex ?? 1) === box)),
  )
  const result: AdaptivePlanWordProgress[] = []
  let added = true
  while (added) {
    added = false
    for (const queue of queues) {
      const row = queue.shift()
      if (!row) continue
      result.push(row)
      added = true
    }
  }
  return result
}

function pickDueReviewKeys(
  rows: AdaptivePlanWordProgress[],
  today: string,
  limit: number,
): string[] {
  const eligible = interleaveDueReviews(activeRows(rows).filter((row) => isDue(row, today)))
  return eligible.slice(0, limit).map((row) => row.wordKey)
}

function pickBossKeys(rows: AdaptivePlanWordProgress[]): string[] {
  return activeRows(rows).filter(isBossPending).map((row) => row.wordKey)
}

export function buildDailyTask(
  plan: AdaptiveWordPlan,
  rows: AdaptivePlanWordProgress[],
  today: string,
): AdaptiveDailyTask {
  const mode = resolveMode(plan, rows, today)
  // An interrupted batch always resumes before another batch starts.
  const unfinishedKeys = activeRows(rows)
    .filter((row) => isUnfinishedSameDayActivation(row, today))
    .map((row) => row.wordKey)
  const unfinishedSet = new Set(unfinishedKeys)
  const allStageReviewKeys = pickDueReviewKeys(rows, today, Number.MAX_SAFE_INTEGER).filter(
    (key) => !unfinishedSet.has(key),
  )
  const mainReviewLimit = Math.max(1, plan.reviewCap)
  const stageReviewKeys = allStageReviewKeys.slice(0, mainReviewLimit)
  const stageReviewCount = stageReviewKeys.length
  const queuedStageCount = Math.max(0, allStageReviewKeys.length - stageReviewKeys.length)

  if (mode === 'boss') {
    const bossKeys = pickBossKeys(rows)
    return {
      mode,
      reviewKeys: stageReviewKeys,
      reviewBatchKeys: stageReviewKeys,
      stageReviewCount,
      queuedStageCount,
      activateKeys: [],
      bossKeys,
      bossUnfinishedNewKeys: [],
    }
  }

  // Configured new-word count is per completed main-line batch, not per day.
  const perDay = Number.isFinite(plan.newWordsPerDay) ? plan.newWordsPerDay : 10
  const batchSize = Math.max(1, Math.floor(perDay))
  const freshSlots = Math.max(0, batchSize - unfinishedKeys.length)
  const freshKeys = pickActivations(rows, freshSlots).map((row) => row.wordKey)
  const activateKeys = [...unfinishedKeys, ...freshKeys]

  return {
    mode,
    reviewKeys: stageReviewKeys,
    reviewBatchKeys: stageReviewKeys,
    stageReviewCount,
    queuedStageCount,
    activateKeys,
    bossKeys: [],
    bossUnfinishedNewKeys: [],
  }
}

/**
 * Compatibility summary for the homepage card. V2 practice is batch-driven;
 * the daily ledger remains analytics only and never gates the next batch.
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
  // Goal met + no mandatory review/boss work.
  const allDone =
    goalMet && unfinishedCount === 0 && task.reviewKeys.length === 0 && task.mode !== 'boss'

  const newDone = Math.min(newGoal, settled)
  const newRemaining = Math.max(0, newGoal - newDone)
  const dueRemaining = task.mode === 'boss' ? task.bossKeys.length : task.reviewKeys.length

  // When finished, show the new-word goal as the completed quota. While work
  // remains, keep done + remaining === total (reviews inflate the denominator).
  const done = allDone ? newGoal : newDone
  const total = allDone ? newGoal : newDone + newRemaining + dueRemaining

  let subtitle: string
  if (allDone) {
    subtitle = '今日任务已完成'
  } else if (unfinishedCount > 0) {
    subtitle = `当前批次还有 ${unfinishedCount} 个新词待练完`
  } else if (task.mode === 'boss') {
    subtitle = `Boss 挑战 · ${task.bossKeys.length} 词`
  } else {
    subtitle = `本批新词 ${task.activateKeys.length} · 阶段推进 ${task.stageReviewCount} · 等待 ${task.queuedStageCount}`
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

export type AdaptiveDailyProgressSnapshot = {
  newGoal: number
  reviewGoal: number
  newDone: number
  reviewDone: number
  allDone: boolean
}

/** Prefer the immutable daily ledger over mutable box-state inference when available. */
export function applyAdaptiveDailyProgress(
  inferred: ReturnType<typeof summarizeAdaptiveTodayProgress>,
  daily: AdaptiveDailyProgressSnapshot | null,
): ReturnType<typeof summarizeAdaptiveTodayProgress> {
  if (!daily) return inferred
  const total = Math.max(0, daily.newGoal) + Math.max(0, daily.reviewGoal)
  const done = Math.min(total, Math.max(0, daily.newDone) + Math.max(0, daily.reviewDone))
  return {
    ...inferred,
    done: daily.allDone ? total : done,
    total,
    allDone: daily.allDone,
    subtitle: daily.allDone
      ? '今日任务已完成'
      : `已完成 ${done}/${total} · 新词 ${daily.newDone}/${daily.newGoal} · 复习 ${daily.reviewDone}/${daily.reviewGoal}`,
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
    (row) =>
      row.status === 'NOT_STARTED' ||
      row.status === 'LEARNING_PENDING' ||
      row.status === 'LEARNING',
  )
}
