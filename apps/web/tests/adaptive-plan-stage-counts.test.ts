import { describe, expect, it } from 'vitest'
import { computeAdaptivePlanStageCounts } from '@rosie/english'
import type { AdaptivePlanWordProgress } from '@rosie/english'

function row(
  partial: Partial<AdaptivePlanWordProgress> & Pick<AdaptivePlanWordProgress, 'wordKey' | 'status'>,
): AdaptivePlanWordProgress {
  return {
    planId: 'plan-1',
    userId: 'user-1',
    boxIndex: null,
    targetBox: null,
    streakWrong: 0,
    nextReviewDate: null,
    introducedOn: null,
    ...partial,
  }
}

describe('computeAdaptivePlanStageCounts', () => {
  it('groups learning words by box and highlights due-today focus', () => {
    const counts = computeAdaptivePlanStageCounts(
      [
        row({ wordKey: 'a', status: 'NOT_STARTED' }),
        row({ wordKey: 'b', status: 'LEARNING_PENDING' }),
        row({ wordKey: 'c', status: 'LEARNING', boxIndex: 1, nextReviewDate: '2026-07-10' }),
        row({ wordKey: 'd', status: 'LEARNING', boxIndex: 2, nextReviewDate: '2026-07-11' }),
        row({ wordKey: 'e', status: 'MASTERED' }),
      ],
      '2026-07-10',
    )

    expect(counts.total).toBe(5)
    expect(counts.queue).toBe(2)
    expect(counts.byBox).toEqual({ 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 })
    expect(counts.byBoxDueToday[1]).toBe(1)
    expect(counts.mastered).toBe(1)
    expect(counts.focus).toBe(1)
  })

  it('focuses pending activation before not-started queue', () => {
    const counts = computeAdaptivePlanStageCounts([
      row({ wordKey: 'a', status: 'NOT_STARTED' }),
      row({ wordKey: 'b', status: 'LEARNING_PENDING' }),
    ])

    expect(counts.focus).toBe('pending')
    expect(counts.notStarted).toBe(1)
    expect(counts.pending).toBe(1)
  })

  it('focuses not-started when nothing is learning yet', () => {
    const counts = computeAdaptivePlanStageCounts([
      row({ wordKey: 'a', status: 'NOT_STARTED' }),
      row({ wordKey: 'b', status: 'NOT_STARTED' }),
    ])

    expect(counts.focus).toBe('not_started')
    expect(counts.queue).toBe(2)
  })

  it('focuses mastered when plan is complete', () => {
    const counts = computeAdaptivePlanStageCounts([
      row({ wordKey: 'a', status: 'MASTERED' }),
      row({ wordKey: 'b', status: 'MASTERED' }),
    ])

    expect(counts.focus).toBe('mastered')
    expect(counts.mastered).toBe(2)
  })
})
