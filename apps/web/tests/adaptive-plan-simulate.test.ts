import { describe, it, expect } from 'vitest'
import { SAMPLE_WORDS_4B } from '../../../packages/english/src/utils/english-data-4b'
import { wordKey } from '../../../packages/english/src/utils/english-helpers'
import { simulateAdaptivePlan } from '../../../packages/english/src/utils/adaptivePlanSimulate'
import type {
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from '../../../packages/english/src/utils/adaptivePlanTypes'
import { activateWord } from '../../../packages/english/src/utils/adaptivePlanBoxes'

const PLAN: AdaptiveWordPlan = {
  id: 'sim-plan',
  userId: 'user-1',
  title: '4B 模拟',
  scope: { stages: ['4B'] },
  newWordsPerDay: 10,
  reviewCap: 40,
  reviewBatchSize: 20,
  backlogFuse: 50,
  bossEveryNNew: 50,
  bossStubbornThreshold: 15,
  bossPackLimit: 50,
  mode: 'normal',
  status: 'active',
  stats: {
    bossFailStreak: 0,
    bossQuestionTier: 1,
    everActivatedCount: 0,
    totalActivatedCount: 0,
    lastBossActivatedCount: 0,
  },
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
}

describe('simulateAdaptivePlan', () => {
  it('simulates 4B all-correct path with 10 words/day', () => {
    const keys = SAMPLE_WORDS_4B.map((w) => wordKey(w))
    const result = simulateAdaptivePlan({
      plan: PLAN,
      wordKeys: keys,
      startDate: '2026-07-01',
      maxDays: 500,
    })

    expect(result.completed).toBe(true)
    expect(result.days.length).toBeGreaterThan(0)

    const day1 = result.days[0]
    expect(day1.newWordKeys).toHaveLength(10)
    expect(day1.reviewWordKeys).toHaveLength(0)
    expect(day1.studyCount).toBe(10)

    const totalIntroduced = result.days.reduce((n, d) => n + d.newWordKeys.length, 0)
    expect(totalIntroduced).toBe(keys.length)

    const firstWord = keys[0]
    const masteryDay = result.wordMasteryDay.get(firstWord)
    expect(masteryDay).toBeGreaterThan(0)
  })

  it('day-1 first word gets study + step3 type A only', () => {
    const keys = ['U1::L1::alpha', 'U1::L1::beta']
    const result = simulateAdaptivePlan({
      plan: { ...PLAN, newWordsPerDay: 1 },
      wordKeys: keys,
      startDate: '2026-07-01',
      maxDays: 30,
    })
    const day1 = result.days[0]
    const alphaFinal = day1.touches.find(
      (t) => t.wordKey === 'U1::L1::alpha' && t.phase === 'step3_final',
    )
    expect(alphaFinal?.quizTypes).toEqual(['A'])
    expect(day1.touches.some((t) => t.wordKey === 'U1::L1::alpha' && t.phase === 'study')).toBe(
      true,
    )
  })

  it('resumes from saved progress and projects fewer remaining days', () => {
    const keys = ['U1::L1::a', 'U1::L1::b', 'U1::L1::c']
    const fresh = simulateAdaptivePlan({
      plan: { ...PLAN, newWordsPerDay: 1 },
      wordKeys: keys,
      startDate: '2026-07-01',
      maxDays: 60,
    })

    const progressedRows: AdaptivePlanWordProgress[] = [
      {
        planId: PLAN.id,
        userId: 'user-1',
        wordKey: 'U1::L1::a',
        status: 'MASTERED',
        boxIndex: null,
        targetBox: null,
        streakWrong: 0,
        nextReviewDate: null,
        introducedOn: '2026-07-01',
      },
      activateWord(
        {
          planId: PLAN.id,
          userId: 'user-1',
          wordKey: 'U1::L1::b',
          status: 'LEARNING',
          boxIndex: 3,
          targetBox: null,
          streakWrong: 0,
          nextReviewDate: '2026-07-10',
          introducedOn: '2026-07-05',
        },
        '2026-07-10',
      ),
      {
        planId: PLAN.id,
        userId: 'user-1',
        wordKey: 'U1::L1::c',
        status: 'NOT_STARTED',
        boxIndex: null,
        targetBox: null,
        streakWrong: 0,
        nextReviewDate: null,
        introducedOn: null,
      },
    ]

    const resumed = simulateAdaptivePlan({
      plan: {
        ...PLAN,
        newWordsPerDay: 1,
        stats: {
          ...PLAN.stats,
          totalActivatedCount: 2,
          everActivatedCount: 2,
        },
      },
      wordKeys: keys,
      initialRows: progressedRows,
      startDate: '2026-07-10',
      maxDays: 60,
    })

    expect(resumed.resumedFromProgress).toBe(true)
    expect(resumed.baseline.tally.mastered).toBe(1)
    expect(resumed.baseline.tally.learning).toBe(1)
    expect(resumed.baseline.tally.notStarted).toBe(1)
    expect(resumed.days.length).toBeLessThan(fresh.days.length)
  })

  it('allows idle days when waiting for Leitner intervals (no early pull-forward)', () => {
    const keys = SAMPLE_WORDS_4B.map((w) => wordKey(w))
    const result = simulateAdaptivePlan({
      plan: PLAN,
      wordKeys: keys,
      startDate: '2026-07-01',
      maxDays: 500,
    })
    const idle = result.days.filter(
      (d) => d.totalQuestions === 0 && d.bossWordKeys.length === 0,
    )
    // After new words run out, Box5's 7-day gap creates true idle days.
    expect(idle.length).toBeGreaterThan(0)
    expect(result.completed).toBe(true)
  })

  it('first batch follows 1/1/2/4/7 box intervals without mid-gap reviews', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `U1::L1::w${i}`)
    const result = simulateAdaptivePlan({
      plan: { ...PLAN, newWordsPerDay: 10 },
      wordKeys: keys,
      startDate: '2026-07-01',
      maxDays: 30,
      captureStageMatrix: true,
    })

    const first = keys[0]!
    const touchDays = result.days
      .filter((d) => d.reviewWordKeys.includes(first) || d.newWordKeys.includes(first))
      .map((d) => d.dayIndex)

    // D1 activate+same-day promote → Box2; then +1/+2/+4/+7 → D2, D4, D8, D15
    expect(touchDays).toEqual([1, 2, 4, 8, 15])
    expect(result.wordMasteryDay.get(first)).toBe(15)
  })
})
