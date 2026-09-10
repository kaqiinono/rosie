import { clampAdaptiveBox } from './adaptivePlanStages'
import type { AdaptivePlanWordProgress } from './adaptivePlanTypes'

export type AdaptivePlanFocusStage = 'not_started' | 'pending' | 1 | 2 | 3 | 4 | 5 | 'boss' | 'mastered'

export type AdaptivePlanStageCounts = {
  total: number
  byBox: Record<1 | 2 | 3 | 4 | 5, number>
  notStarted: number
  pending: number
  bossPending: number
  queue: number
  mastered: number
  learning: number
  focus: AdaptivePlanFocusStage
}

function emptyBoxRecord(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function resolveFocusStage(
  counts: Omit<AdaptivePlanStageCounts, 'focus'>,
): AdaptivePlanFocusStage {
  if (counts.total > 0 && counts.mastered >= counts.total) return 'mastered'
  if (counts.learning === 0) {
    if (counts.bossPending > 0) return 'boss'
    if (counts.pending > 0) return 'pending'
    if (counts.notStarted > 0) return 'not_started'
  }

  for (const box of [1, 2, 3, 4, 5] as const) {
    if (counts.byBox[box] > 0) return box
  }

  if (counts.pending > 0) return 'pending'
  if (counts.bossPending > 0) return 'boss'
  if (counts.notStarted > 0) return 'not_started'
  if (counts.mastered > 0) return 'mastered'
  return 'not_started'
}

export function computeAdaptivePlanStageCounts(
  rows: AdaptivePlanWordProgress[],
  _today = new Date().toISOString().slice(0, 10),
): AdaptivePlanStageCounts {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const byBox = emptyBoxRecord()

  let notStarted = 0
  let pending = 0
  let mastered = 0
  let learning = 0
  let bossPending = 0

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
      if (row.targetBox == null && row.boxIndex === 5) bossPending += 1
      else pending += 1
      continue
    }
    if (row.status === 'LEARNING') {
      learning += 1
      const box = clampAdaptiveBox(row.boxIndex)
      byBox[box] += 1
    }
  }

  const base = {
    total: activeRows.length,
    byBox,
    notStarted,
    pending,
    bossPending,
    queue: notStarted + pending,
    mastered,
    learning,
  }

  return {
    ...base,
    focus: resolveFocusStage(base),
  }
}
