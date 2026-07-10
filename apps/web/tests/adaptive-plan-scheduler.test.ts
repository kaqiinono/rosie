import { describe, it, expect } from 'vitest'
import type {
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from '../../../packages/english/src/utils/adaptivePlanTypes'
import {
  isDue,
  countDueLearning,
  countActivatedToday,
  pickActivations,
  resolveMode,
  buildDailyTask,
  isPlanCompletable,
} from '../../../packages/english/src/utils/adaptivePlanScheduler'

const TODAY = '2026-07-09'

const basePlan = (overrides: Partial<AdaptiveWordPlan> = {}): AdaptiveWordPlan => ({
  id: 'plan-1',
  userId: 'user-1',
  title: 'Test Plan',
  scope: {},
  newWordsPerDay: 10,
  reviewCap: 40,
  reviewBatchSize: 20,
  backlogFuse: 50,
  bossEveryNNew: 50,
  bossStubbornThreshold: 15,
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
  ...overrides,
})

const row = (wordKey: string, overrides: Partial<AdaptivePlanWordProgress> = {}): AdaptivePlanWordProgress => ({
  planId: 'plan-1',
  userId: 'user-1',
  wordKey,
  status: 'NOT_STARTED',
  boxIndex: null,
  targetBox: null,
  streakWrong: 0,
  nextReviewDate: null,
  introducedOn: null,
  ...overrides,
})

describe('isDue', () => {
  it('is due when LEARNING and nextReviewDate <= today (string compare)', () => {
    expect(isDue(row('a', { status: 'LEARNING', nextReviewDate: TODAY }), TODAY)).toBe(true)
    expect(
      isDue(row('b', { status: 'LEARNING', nextReviewDate: '2026-07-08' }), TODAY),
    ).toBe(true)
  })

  it('is not due when nextReviewDate is after today', () => {
    expect(
      isDue(row('c', { status: 'LEARNING', nextReviewDate: '2026-07-10' }), TODAY),
    ).toBe(false)
  })

  it('is not due for non-LEARNING or null nextReviewDate', () => {
    expect(isDue(row('d', { status: 'NOT_STARTED' }), TODAY)).toBe(false)
    expect(isDue(row('e', { status: 'LEARNING', nextReviewDate: null }), TODAY)).toBe(false)
    expect(isDue(row('f', { status: 'LEARNING_PENDING' }), TODAY)).toBe(false)
  })

  it('uses lexicographic compare, not Date objects', () => {
    // YYYY-MM-DD strings sort correctly; would fail if parsed as local midnight timestamps.
    expect(
      isDue(row('g', { status: 'LEARNING', nextReviewDate: '2026-07-09' }), '2026-07-09'),
    ).toBe(true)
    expect(
      isDue(row('h', { status: 'LEARNING', nextReviewDate: '2026-07-09' }), '2026-07-08'),
    ).toBe(false)
  })
})

describe('countDueLearning', () => {
  it('counts only due LEARNING rows', () => {
    const rows = [
      row('due1', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('due2', { status: 'LEARNING', nextReviewDate: '2026-07-08' }),
      row('future', { status: 'LEARNING', nextReviewDate: '2026-07-10' }),
      row('pending', { status: 'LEARNING_PENDING' }),
    ]
    expect(countDueLearning(rows, TODAY)).toBe(2)
  })

  it('excludes archived rows', () => {
    const rows = [
      row('due', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('archived', { status: 'LEARNING', nextReviewDate: TODAY, archivedAt: TODAY }),
    ]
    expect(countDueLearning(rows, TODAY)).toBe(1)
  })
})

describe('pickActivations', () => {
  it('prioritizes PENDING target 3, then target 1, then NOT_STARTED', () => {
    const rows = [
      row('ns1', { status: 'NOT_STARTED' }),
      row('p1', { status: 'LEARNING_PENDING', targetBox: 1 }),
      row('p3', { status: 'LEARNING_PENDING', targetBox: 3 }),
      row('ns2', { status: 'NOT_STARTED' }),
      row('p3b', { status: 'LEARNING_PENDING', targetBox: 3 }),
    ]
    const picked = pickActivations(rows, 4)
    expect(picked.map(r => r.wordKey)).toEqual(['p3', 'p3b', 'p1', 'ns1'])
  })

  it('respects n limit', () => {
    const rows = [
      row('p3', { status: 'LEARNING_PENDING', targetBox: 3 }),
      row('ns', { status: 'NOT_STARTED' }),
    ]
    expect(pickActivations(rows, 1)).toHaveLength(1)
    expect(pickActivations(rows, 0)).toHaveLength(0)
  })

  it('treats NaN / non-finite n as zero (never dump the whole queue)', () => {
    const rows = Array.from({ length: 33 }, (_, i) =>
      row(`w${i}`, { status: 'NOT_STARTED' }),
    )
    expect(pickActivations(rows, Number.NaN)).toHaveLength(0)
    expect(pickActivations(rows, Number.POSITIVE_INFINITY)).toHaveLength(0)
  })
})

describe('resolveMode', () => {
  it('returns boss when plan.mode is boss', () => {
    const plan = basePlan({ mode: 'boss' })
    expect(resolveMode(plan, [], TODAY)).toBe('boss')
  })

  it('returns boss on quantitative trigger', () => {
    const plan = basePlan({
      bossEveryNNew: 50,
      stats: {
        bossFailStreak: 0,
        bossQuestionTier: 1,
        everActivatedCount: 100,
        totalActivatedCount: 100,
        lastBossActivatedCount: 49,
      },
    })
    expect(resolveMode(plan, [], TODAY)).toBe('boss')
  })

  it('returns boss on qualitative trigger (streakWrong >= 2 count)', () => {
    const plan = basePlan({ bossStubbornThreshold: 2 })
    const rows = [
      row('a', { status: 'LEARNING', streakWrong: 2 }),
      row('b', { status: 'LEARNING', streakWrong: 3 }),
      row('c', { status: 'LEARNING', streakWrong: 1 }),
    ]
    expect(resolveMode(plan, rows, TODAY)).toBe('boss')
  })

  it('returns review_only when due count exceeds backlogFuse', () => {
    const plan = basePlan({ backlogFuse: 2 })
    const rows = [
      row('a', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('b', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('c', { status: 'LEARNING', nextReviewDate: TODAY }),
    ]
    expect(resolveMode(plan, rows, TODAY)).toBe('review_only')
  })

  it('returns review_only at fuse boundary (> not >=)', () => {
    const plan = basePlan({ backlogFuse: 3 })
    const rows = Array.from({ length: 3 }, (_, i) =>
      row(`w${i}`, { status: 'LEARNING', nextReviewDate: TODAY }),
    )
    expect(resolveMode(plan, rows, TODAY)).toBe('normal')
    rows.push(row('extra', { status: 'LEARNING', nextReviewDate: TODAY }))
    expect(resolveMode(plan, rows, TODAY)).toBe('review_only')
  })

  it('returns normal when no triggers fire', () => {
    const plan = basePlan()
    const rows = [row('ns', { status: 'NOT_STARTED' })]
    expect(resolveMode(plan, rows, TODAY)).toBe('normal')
  })

  it('boss takes precedence over fuse', () => {
    const plan = basePlan({ mode: 'boss', backlogFuse: 1 })
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(`w${i}`, { status: 'LEARNING', nextReviewDate: TODAY }),
    )
    expect(resolveMode(plan, rows, TODAY)).toBe('boss')
  })
})

describe('buildDailyTask', () => {
  it('caps reviewKeys by reviewCap and slices reviewBatchKeys', () => {
    const plan = basePlan({ reviewCap: 3, reviewBatchSize: 2 })
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(`due${i}`, {
        status: 'LEARNING',
        nextReviewDate: `2026-07-0${i + 5}`, // 05..09 — soonest first
        boxIndex: 1,
      }),
    )
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.mode).toBe('normal')
    expect(task.reviewKeys).toHaveLength(3)
    expect(task.reviewBatchKeys).toHaveLength(2)
    expect(task.reviewBatchKeys).toEqual(task.reviewKeys.slice(0, 2))
  })

  it('includes activateKeys in normal mode', () => {
    const plan = basePlan({ newWordsPerDay: 2 })
    const rows = [
      row('p3', { status: 'LEARNING_PENDING', targetBox: 3 }),
      row('ns', { status: 'NOT_STARTED' }),
    ]
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.activateKeys).toEqual(['p3', 'ns'])
    expect(task.bossKeys).toEqual([])
  })

  it('deducts words already activated today from the daily quota', () => {
    const plan = basePlan({ newWordsPerDay: 3 })
    const rows = [
      // Two words already introduced today in an earlier round…
      row('done1', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY, nextReviewDate: '2026-07-10' }),
      row('done2', { status: 'MASTERED', introducedOn: TODAY }),
      // …plus a backlog of fresh candidates.
      row('ns1', { status: 'NOT_STARTED' }),
      row('ns2', { status: 'NOT_STARTED' }),
      row('ns3', { status: 'NOT_STARTED' }),
    ]
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.activateKeys).toEqual(['ns1'])
  })

  it('stops pulling new words once the daily quota is exhausted', () => {
    const plan = basePlan({ newWordsPerDay: 2 })
    const rows = [
      row('done1', { status: 'LEARNING', boxIndex: 2, introducedOn: TODAY, nextReviewDate: '2026-07-10' }),
      row('done2', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY, nextReviewDate: TODAY }),
      row('ns', { status: 'NOT_STARTED' }),
    ]
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.activateKeys).toEqual([])
  })

  it('counts activations only for today (yesterday does not consume quota)', () => {
    const rows = [
      row('yesterday', { status: 'LEARNING', boxIndex: 2, introducedOn: '2026-07-08' }),
      row('today', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY }),
      row('archived', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY, archivedAt: TODAY }),
    ]
    expect(countActivatedToday(rows, TODAY)).toBe(1)
  })

  it('clears activateKeys in review_only mode', () => {
    const plan = basePlan({ backlogFuse: 1 })
    const rows = [
      row('due1', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('due2', { status: 'LEARNING', nextReviewDate: TODAY }),
      row('ns', { status: 'NOT_STARTED' }),
    ]
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.mode).toBe('review_only')
    expect(task.activateKeys).toEqual([])
    expect(task.bossKeys).toEqual([])
    expect(task.reviewKeys.length).toBeGreaterThan(0)
  })

  it('builds bossKeys from LEARNING pool with streak/date/intro sort', () => {
    const plan = basePlan({ mode: 'boss' })
    const rows = [
      row('low', {
        status: 'LEARNING',
        streakWrong: 0,
        nextReviewDate: '2026-07-10',
        introducedOn: '2026-07-01',
        boxIndex: 1,
      }),
      row('high', {
        status: 'LEARNING',
        streakWrong: 3,
        nextReviewDate: '2026-07-08',
        introducedOn: '2026-07-05',
        boxIndex: 1,
      }),
      row('mid', {
        status: 'LEARNING',
        streakWrong: 3,
        nextReviewDate: TODAY,
        introducedOn: '2026-07-06',
        boxIndex: 1,
      }),
    ]
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.mode).toBe('boss')
    expect(task.activateKeys).toEqual([])
    expect(task.bossKeys[0]).toBe('high')
    expect(task.bossKeys[1]).toBe('mid')
    expect(task.bossKeys[2]).toBe('low')
  })

  it('caps bossKeys at 50', () => {
    const plan = basePlan({ mode: 'boss' })
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(`w${i}`, { status: 'LEARNING', boxIndex: 1, nextReviewDate: TODAY }),
    )
    const task = buildDailyTask(plan, rows, TODAY)
    expect(task.bossKeys).toHaveLength(50)
  })
})

describe('isPlanCompletable', () => {
  it('returns false when hasOpenSession', () => {
    const rows = [row('m', { status: 'MASTERED' })]
    expect(isPlanCompletable(rows, true)).toBe(false)
  })

  it('returns false when any NOT_STARTED, LEARNING_PENDING, or LEARNING remain', () => {
    expect(isPlanCompletable([row('ns', { status: 'NOT_STARTED' })], false)).toBe(false)
    expect(
      isPlanCompletable([row('p', { status: 'LEARNING_PENDING', targetBox: 1 })], false),
    ).toBe(false)
    expect(
      isPlanCompletable(
        [row('l', { status: 'LEARNING', boxIndex: 1, nextReviewDate: TODAY })],
        false,
      ),
    ).toBe(false)
  })

  it('returns true when only MASTERED remain and no open session', () => {
    const rows = [
      row('a', { status: 'MASTERED' }),
      row('b', { status: 'MASTERED' }),
    ]
    expect(isPlanCompletable(rows, false)).toBe(true)
  })

  it('returns true for empty active pipeline (all archived or empty)', () => {
    expect(isPlanCompletable([], false)).toBe(true)
    expect(
      isPlanCompletable(
        [row('a', { status: 'LEARNING', archivedAt: TODAY })],
        false,
      ),
    ).toBe(true)
  })
})
