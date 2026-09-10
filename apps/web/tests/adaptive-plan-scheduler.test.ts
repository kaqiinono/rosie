import { describe, expect, it } from 'vitest'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../../packages/english/src/utils/adaptivePlanTypes'
import { buildDailyTask, countDueLearning, isBossPending, isDue, isPlanCompletable, pickActivations, resolveMode } from '../../../packages/english/src/utils/adaptivePlanScheduler'

const TODAY = '2026-07-09'
const makePlan = (overrides: Partial<AdaptiveWordPlan> = {}): AdaptiveWordPlan => ({
  id: 'p', userId: 'u', title: 'V2', scope: {}, newWordsPerDay: 5, reviewCap: 8,
  reviewBatchSize: 2, backlogFuse: 10, bossEveryNNew: 10, bossStubbornThreshold: 15,
  bossPackLimit: 3, mode: 'normal', status: 'active',
  stats: { bossFailStreak: 0, bossQuestionTier: 1, everActivatedCount: 0, totalActivatedCount: 0, lastBossActivatedCount: 0 },
  createdAt: '', updatedAt: '', ...overrides,
})
const makeRow = (wordKey: string, overrides: Partial<AdaptivePlanWordProgress> = {}): AdaptivePlanWordProgress => ({
  planId: 'p', userId: 'u', wordKey, status: 'NOT_STARTED', boxIndex: null,
  targetBox: null, streakWrong: 0, nextReviewDate: null, introducedOn: null, ...overrides,
})
const learning = (key: string, boxIndex: 1 | 2 | 3 | 4 | 5, streakWrong = 0) =>
  makeRow(key, { status: 'LEARNING', boxIndex, streakWrong })
const boss = (key: string) =>
  makeRow(key, { status: 'LEARNING_PENDING', boxIndex: 5, targetBox: null })

describe('continuous batch eligibility', () => {
  it('ignores legacy dates for learning rows', () => {
    expect(isDue(makeRow('a', { status: 'LEARNING', boxIndex: 2, nextReviewDate: '2099-01-01' }), TODAY)).toBe(true)
    expect(isDue(makeRow('b', { status: 'LEARNING', boxIndex: 2 }), TODAY)).toBe(true)
    expect(isDue(makeRow('c'), TODAY)).toBe(false)
    expect(countDueLearning([learning('a', 1), learning('b', 5), makeRow('c')], TODAY)).toBe(2)
  })

  it('recognizes only the Stage-5 Boss waiting encoding', () => {
    expect(isBossPending(boss('a'))).toBe(true)
    expect(isBossPending(makeRow('b', { status: 'LEARNING_PENDING', boxIndex: 3, targetBox: 3 }))).toBe(false)
  })
})

describe('activation and main line', () => {
  it('prioritizes pending target 3, pending target 1, then not-started', () => {
    const picked = pickActivations([
      makeRow('n1'),
      makeRow('p1', { status: 'LEARNING_PENDING', targetBox: 1 }),
      makeRow('p3', { status: 'LEARNING_PENDING', targetBox: 3 }),
      makeRow('n2'),
    ], 3)
    expect(picked.map((item) => item.wordKey)).toEqual(['p3', 'p1', 'n1'])
  })

  it('adds configured new words on every fresh batch on the same date', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => makeRow(`done-${i}`, { status: 'LEARNING', boxIndex: 2, introducedOn: TODAY })),
      ...Array.from({ length: 6 }, (_, i) => makeRow(`new-${i}`)),
    ]
    expect(buildDailyTask(makePlan(), rows, TODAY).activateKeys).toEqual(['new-0', 'new-1', 'new-2', 'new-3', 'new-4'])
  })

  it('caps stage progression by reviewCap, not legacy reviewBatchSize', () => {
    const task = buildDailyTask(makePlan({ reviewCap: 4, reviewBatchSize: 1 }), Array.from({ length: 7 }, (_, i) => learning(`w${i}`, 1)), TODAY)
    expect(task.reviewKeys).toHaveLength(4)
    expect(task.reviewBatchKeys).toHaveLength(4)
    expect(task.stageReviewCount).toBe(4)
    expect(task.queuedStageCount).toBe(3)
  })

  it('interleaves stages and prioritizes weak words inside a stage', () => {
    const task = buildDailyTask(makePlan({ reviewCap: 5 }), [
      learning('s1-plain', 1), learning('s1-weak', 1, 2), learning('s2', 2),
      learning('s3', 3), learning('s4', 4), learning('s5', 5),
    ], TODAY)
    expect(task.reviewKeys).toEqual(['s1-weak', 's2', 's3', 's4', 's5'])
  })

  it('resumes an interrupted activation and fills remaining new slots', () => {
    const rows = [
      makeRow('resume', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY }),
      ...Array.from({ length: 6 }, (_, i) => makeRow(`new-${i}`)),
    ]
    expect(buildDailyTask(makePlan(), rows, TODAY).activateKeys).toEqual(['resume', 'new-0', 'new-1', 'new-2', 'new-3'])
  })
})

describe('Boss checkpoint', () => {
  it('waits for both cumulative threshold and a Boss-ready word', () => {
    const triggered = makePlan({ stats: { ...makePlan().stats, totalActivatedCount: 10 } })
    expect(resolveMode(triggered, [learning('a', 4)], TODAY)).toBe('normal')
    expect(resolveMode(triggered, [boss('a'), makeRow('new')], TODAY)).toBe('boss')
  })

  it('does not use weak-word count as a Boss trigger', () => {
    const rows = [boss('ready'), ...Array.from({ length: 20 }, (_, i) => learning(`weak-${i}`, 2, 3))]
    expect(resolveMode(makePlan(), rows, TODAY)).toBe('normal')
  })

  it('freezes every waiting word without the legacy pack limit', () => {
    const rows = Array.from({ length: 7 }, (_, i) => boss(`boss-${i}`))
    const task = buildDailyTask(makePlan({ mode: 'boss', bossPackLimit: 2 }), rows, TODAY)
    expect(task.mode).toBe('boss')
    expect(task.bossKeys).toHaveLength(7)
  })

  it('finishes an interrupted main-line batch before starting Boss', () => {
    const triggered = makePlan({ mode: 'boss', stats: { ...makePlan().stats, totalActivatedCount: 10 } })
    const rows = [
      boss('ready'),
      makeRow('unfinished', { status: 'LEARNING', boxIndex: 1, introducedOn: TODAY }),
    ]
    const task = buildDailyTask(triggered, rows, TODAY)
    expect(task.mode).toBe('normal')
    expect(task.activateKeys).toContain('unfinished')
    expect(task.bossKeys).toEqual([])
  })

  it('runs a final Boss when no new or learning words remain', () => {
    expect(resolveMode(makePlan(), [boss('last')], TODAY)).toBe('boss')
  })
})

describe('completion', () => {
  it('requires all active rows mastered and no open session', () => {
    expect(isPlanCompletable([makeRow('a', { status: 'MASTERED' })], false)).toBe(true)
    expect(isPlanCompletable([boss('a')], false)).toBe(false)
    expect(isPlanCompletable([makeRow('a', { status: 'MASTERED' })], true)).toBe(false)
  })
})
