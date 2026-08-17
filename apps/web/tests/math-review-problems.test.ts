import { describe, expect, it } from 'vitest'
import type { ProblemMasteryMap } from '@rosie/core'
import { getMathReviewProblemsForDay } from '@rosie/math-kit/utils/math-helpers'

describe('getMathReviewProblemsForDay', () => {
  it('returns each due problem once when plan sources contain duplicate keys', () => {
    const masteryMap: ProblemMasteryMap = {
      '2-5::2-5-L1': {
        correct: 1,
        incorrect: 0,
        lastSeen: '2026-08-01',
        stage: 1,
        nextReviewDate: '2026-08-10',
      },
      '2-4::2-4-L1': {
        correct: 1,
        incorrect: 0,
        lastSeen: '2026-08-01',
        stage: 1,
        nextReviewDate: '2026-08-10',
      },
    }

    expect(
      getMathReviewProblemsForDay(
        '2026-08-17',
        ['2-5::2-5-L1', '2-4::2-4-L1', '2-5::2-5-L1'],
        masteryMap,
        new Set(),
      ),
    ).toEqual(['2-5::2-5-L1', '2-4::2-4-L1'])
  })
})
