import { describe, it, expect } from 'vitest'
import type { AdaptivePlanWordProgress } from '../../../packages/english/src/utils/adaptivePlanTypes'
import {
  BOX_INTERVALS_DAYS,
  addCalendarDays,
  applyBoxAnswer,
  activateWord,
} from '../../../packages/english/src/utils/adaptivePlanBoxes'

const TODAY = '2026-07-09'

const row = (overrides: Partial<AdaptivePlanWordProgress> = {}): AdaptivePlanWordProgress => ({
  planId: 'plan-1',
  userId: 'user-1',
  wordKey: 'U1::L1::cat',
  status: 'LEARNING',
  boxIndex: 1,
  targetBox: null,
  streakWrong: 0,
  nextReviewDate: TODAY,
  introducedOn: TODAY,
  ...overrides,
})

describe('BOX_INTERVALS_DAYS', () => {
  it('matches spec §4.3', () => {
    expect(BOX_INTERVALS_DAYS).toEqual({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 7 })
  })
})

describe('addCalendarDays', () => {
  it('adds calendar days at noon to avoid DST edge', () => {
    expect(addCalendarDays('2026-07-09', 1)).toBe('2026-07-10')
    expect(addCalendarDays('2026-07-09', 7)).toBe('2026-07-16')
  })
})

describe('applyBoxAnswer', () => {
  it('wrong demotes to box 1, increments streakWrong, and stays due today', () => {
    const out = applyBoxAnswer(row({ boxIndex: 4, streakWrong: 1 }), false, TODAY)
    expect(out.boxIndex).toBe(1)
    expect(out.streakWrong).toBe(2)
    expect(out.nextReviewDate).toBe(TODAY)
  })

  it('correct on box 4 promotes to box 5 with +7 days', () => {
    const out = applyBoxAnswer(row({ boxIndex: 4 }), true, TODAY)
    expect(out.boxIndex).toBe(5)
    expect(out.streakWrong).toBe(0)
    expect(out.status).toBe('LEARNING')
    expect(out.nextReviewDate).toBe(addCalendarDays(TODAY, BOX_INTERVALS_DAYS[5]))
  })

  it('correct on box 5 before due date stays LEARNING in box 5', () => {
    const out = applyBoxAnswer(
      row({ boxIndex: 5, nextReviewDate: addCalendarDays(TODAY, 1) }),
      true,
      TODAY,
    )
    expect(out.status).toBe('LEARNING')
    expect(out.boxIndex).toBe(5)
    expect(out.nextReviewDate).toBe(addCalendarDays(TODAY, 1))
    expect(out.streakWrong).toBe(0)
  })

  it('correct on due box 5 graduates to MASTERED and clears boxIndex', () => {
    const out = applyBoxAnswer(row({ boxIndex: 5, nextReviewDate: TODAY }), true, TODAY)
    expect(out.status).toBe('MASTERED')
    expect(out.boxIndex).toBeNull()
    expect(out.nextReviewDate).toBeNull()
    expect(out.streakWrong).toBe(0)
  })
})

describe('activateWord', () => {
  it('activates NOT_STARTED at box 1 with due tomorrow', () => {
    const out = activateWord(
      {
        ...row({ status: 'NOT_STARTED', boxIndex: null, nextReviewDate: null, introducedOn: null }),
        status: 'NOT_STARTED',
      },
      TODAY,
    )
    expect(out.status).toBe('LEARNING')
    expect(out.boxIndex).toBe(1)
    expect(out.targetBox).toBeNull()
    expect(out.introducedOn).toBe(TODAY)
    expect(out.nextReviewDate).toBe(addCalendarDays(TODAY, 1))
    expect(out.nextReviewDate).not.toBe(TODAY)
  })

  it('activates LEARNING_PENDING with target_box 3 at box 3', () => {
    const out = activateWord(
      row({
        status: 'LEARNING_PENDING',
        boxIndex: null,
        targetBox: 3,
        nextReviewDate: null,
        introducedOn: null,
      }),
      TODAY,
    )
    expect(out.boxIndex).toBe(3)
    expect(out.nextReviewDate).toBe(addCalendarDays(TODAY, BOX_INTERVALS_DAYS[3]))
  })
})
