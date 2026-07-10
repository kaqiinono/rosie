import { clampAdaptiveBox } from './adaptivePlanStages'
import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

export type AdaptivePlanFocusStage = 'not_started' | 'pending' | 1 | 2 | 3 | 4 | 5 | 'mastered'

export type AdaptivePlanStageCounts = {
  total: number
  byBox: Record<1 | 2 | 3 | 4 | 5, number>
  byBoxDueToday: Record<1 | 2 | 3 | 4 | 5, number>
  notStarted: number
  pending: number
  queue: number
  mastered: number
  learning: number
  focus: AdaptivePlanFocusStage
}

function emptyBoxRecord(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function isDueToday(nextReviewDate: string | null | undefined, today: string): boolean {
  if (!nextReviewDate) return false
  return nextReviewDate <= today
}

function resolveFocusStage(
  counts: Omit<AdaptivePlanStageCounts, 'focus'>,
): AdaptivePlanFocusStage {
  if (counts.total > 0 && counts.mastered >= counts.total) return 'mastered'
  if (counts.learning === 0) {
    if (counts.pending > 0) return 'pending'
    if (counts.notStarted > 0) return 'not_started'
  }

  let bestDueBox: 1 | 2 | 3 | 4 | 5 | null = null
  let bestDueCount = 0
  for (const box of [1, 2, 3, 4, 5] as const) {
    const due = counts.byBoxDueToday[box]
    if (due > bestDueCount) {
      bestDueCount = due
      bestDueBox = box
    }
  }
  if (bestDueBox != null && bestDueCount > 0) return bestDueBox

  for (const box of [1, 2, 3, 4, 5] as const) {
    if (counts.byBox[box] > 0) return box
  }

  if (counts.pending > 0) return 'pending'
  if (counts.notStarted > 0) return 'not_started'
  if (counts.mastered > 0) return 'mastered'
  return 'not_started'
}

export function computeAdaptivePlanStageCounts(
  rows: AdaptivePlanWordProgress[],
  today = new Date().toISOString().slice(0, 10),
): AdaptivePlanStageCounts {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const byBox = emptyBoxRecord()
  const byBoxDueToday = emptyBoxRecord()

  let notStarted = 0
  let pending = 0
  let mastered = 0
  let learning = 0

  for (const row of activeRows) {
    if (row.status === 'MASTERED') {
      mastered += 1
      continue
    }
    if (row.status === 'NOT_STARTED') {
      notStarted += 1
      continue
    }
    if (row.status === 'LEARNING_PENDING') {
      pending += 1
      continue
    }
    if (row.status === 'LEARNING') {
      learning += 1
      const box = clampAdaptiveBox(row.boxIndex)
      byBox[box] += 1
      if (isDueToday(row.nextReviewDate, today)) {
        byBoxDueToday[box] += 1
      }
    }
  }

  const base = {
    total: activeRows.length,
    byBox,
    byBoxDueToday,
    notStarted,
    pending,
    queue: notStarted + pending,
    mastered,
    learning,
  }

  return {
    ...base,
    focus: resolveFocusStage(base),
  }
}
