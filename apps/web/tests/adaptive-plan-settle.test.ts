import { describe, it, expect } from 'vitest'
import type { WordEntry, WordMasteryMap, WeeklyPlan } from '../../../packages/core/src/type'
import type {
  AdaptivePlanStats,
  AdaptivePlanWordProgress,
} from '../../../packages/english/src/utils/adaptivePlanTypes'
import {
  collapseSessionOutcomes,
  buildConsolidateExemptSet,
  settleStep3,
  settleBossFirstPass,
} from '../../../packages/english/src/utils/adaptivePlanSettle'

const TODAY = '2026-07-09'

const row = (
  wordKey: string,
  overrides: Partial<AdaptivePlanWordProgress> = {},
): AdaptivePlanWordProgress => ({
  planId: 'plan-1',
  userId: 'user-1',
  wordKey,
  status: 'LEARNING',
  boxIndex: 2,
  targetBox: null,
  streakWrong: 0,
  nextReviewDate: TODAY,
  introducedOn: TODAY,
  ...overrides,
})

const stats = (overrides: Partial<AdaptivePlanStats> = {}): AdaptivePlanStats => ({
  bossFailStreak: 0,
  bossQuestionTier: 1,
  everActivatedCount: 0,
  totalActivatedCount: 0,
  lastBossActivatedCount: 0,
  ...overrides,
})

const vocab: WordEntry[] = [
  { unit: 'U1', lesson: 'L1', word: 'cat' },
  { unit: 'U1', lesson: 'L1', word: 'dog' },
  { unit: 'U1', lesson: 'L2', word: 'bird' },
]

const weeklyPlan: WeeklyPlan = {
  weekStart: '2026-07-03',
  unit: 'U1',
  lesson: 'L1',
  weekStartDay: 4,
  newWordsPerDay: 3,
  days: [
    { date: '2026-07-03', newWordKeys: ['U1::L1::cat', 'U1::L1::dog'] },
    { date: '2026-07-04', newWordKeys: ['U1::L2::bird'] },
    ...Array.from({ length: 5 }, (_, i) => ({
      date: `2026-07-0${5 + i}`,
      newWordKeys: [] as string[],
    })),
  ],
  previewLessonKeys: ['U1::L2'],
}

describe('collapseSessionOutcomes', () => {
  it('last write wins per wordKey', () => {
    const m = collapseSessionOutcomes([
      { wordKey: 'a', correct: false },
      { wordKey: 'b', correct: true },
      { wordKey: 'a', correct: true },
    ])
    expect(m.get('a')).toBe(true)
    expect(m.get('b')).toBe(true)
  })
})

describe('buildConsolidateExemptSet', () => {
  it('returns consolidate keys from active weekly plan', () => {
    const exempt = buildConsolidateExemptSet(weeklyPlan, vocab)
    expect(exempt.has('U1::L1::cat')).toBe(true)
    expect(exempt.has('U1::L1::dog')).toBe(true)
    expect(exempt.has('U1::L2::bird')).toBe(false)
  })

  it('returns empty set when no active plan', () => {
    expect(buildConsolidateExemptSet(null, vocab).size).toBe(0)
  })
})

describe('settleStep3', () => {
  it('applies one applyBoxAnswer per key using final outcome', () => {
    const key = 'U1::L1::cat'
    const out = settleStep3({
      progressRows: [row(key, { boxIndex: 2 })],
      results: [
        { wordKey: key, correct: false },
        { wordKey: key, correct: true },
      ],
      masteryByKey: {},
      consolidateExemptSet: new Set(),
      today: TODAY,
    })
    expect(out.progressUpdates).toHaveLength(1)
    expect(out.progressUpdates[0].boxIndex).toBe(3)
    expect(out.progressUpdates[0].streakWrong).toBe(0)
  })

  it('wrong-then-correct emits advance only, never regress', () => {
    const key = 'U1::L1::cat'
    const masteryByKey: WordMasteryMap = {
      [key]: { correct: 5, incorrect: 0, lastSeen: '2026-07-08', stage: 2 },
    }
    const out = settleStep3({
      progressRows: [row(key, { boxIndex: 2 })],
      results: [
        { wordKey: key, correct: false },
        { wordKey: key, correct: true },
      ],
      masteryByKey,
      consolidateExemptSet: new Set(),
      today: TODAY,
    })
    expect(out.masteryPatches).toHaveLength(1)
    expect(out.masteryPatches[0].wordKey).toBe(key)
    expect(out.masteryPatches[0].info.stage).toBe(3)
    expect(out.masteryPatches.some(p => (p.info.stage ?? 0) < 2)).toBe(false)
  })

  it('exempt consolidate key blocks regress on final wrong', () => {
    const key = 'U1::L1::cat'
    const masteryByKey: WordMasteryMap = {
      [key]: { correct: 5, incorrect: 0, lastSeen: '2026-07-08', stage: 3 },
    }
    const out = settleStep3({
      progressRows: [row(key, { boxIndex: 4, streakWrong: 1 })],
      results: [{ wordKey: key, correct: false }],
      masteryByKey,
      consolidateExemptSet: new Set([key]),
      today: TODAY,
    })
    expect(out.progressUpdates[0].streakWrong).toBe(2)
    expect(out.masteryPatches).toHaveLength(0)
  })

  it('regresses when final wrong, streakWrong>=2, not exempt', () => {
    const key = 'U1::L2::bird'
    const masteryByKey: WordMasteryMap = {
      [key]: { correct: 5, incorrect: 0, lastSeen: '2026-07-08', stage: 3 },
    }
    const out = settleStep3({
      progressRows: [row(key, { boxIndex: 4, streakWrong: 1 })],
      results: [{ wordKey: key, correct: false }],
      masteryByKey,
      consolidateExemptSet: buildConsolidateExemptSet(weeklyPlan, vocab),
      today: TODAY,
    })
    expect(out.masteryPatches).toHaveLength(1)
    expect(out.masteryPatches[0].info.stage).toBe(1)
    expect(out.masteryPatches[0].info.isHard).toBe(true)
  })
})

describe('settleBossFirstPass', () => {
  it('first-pass correct promotes; first-pass wrong demotes once', () => {
    const good = 'U1::L1::cat'
    const bad = 'U1::L1::dog'
    const out = settleBossFirstPass({
      progressRows: [
        row(good, { boxIndex: 2 }),
        row(bad, { boxIndex: 4, streakWrong: 0 }),
      ],
      firstPassResults: [
        { wordKey: good, correct: true },
        { wordKey: bad, correct: false },
      ],
      masteryByKey: {},
      consolidateExemptSet: new Set(),
      currentStats: stats(),
      today: TODAY,
    })
    const goodRow = out.progressUpdates.find(r => r.wordKey === good)!
    const badRow = out.progressUpdates.find(r => r.wordKey === bad)!
    expect(goodRow.boxIndex).toBe(3)
    expect(badRow.boxIndex).toBe(1)
    expect(badRow.streakWrong).toBe(1)
  })

  it('sink correct does not promote box', () => {
    const key = 'U1::L1::dog'
    const out = settleBossFirstPass({
      progressRows: [row(key, { boxIndex: 4 })],
      firstPassResults: [{ wordKey: key, correct: false }],
      sinkResults: [{ wordKey: key, correct: true }],
      masteryByKey: {},
      consolidateExemptSet: new Set(),
      currentStats: stats(),
      today: TODAY,
    })
    expect(out.progressUpdates[0].boxIndex).toBe(1)
    expect(out.progressUpdates[0].streakWrong).toBe(1)
  })

  it('sink correct after first-pass wrong collapses to advance-only mastery', () => {
    const key = 'U1::L1::cat'
    const masteryByKey: WordMasteryMap = {
      [key]: { correct: 5, incorrect: 0, lastSeen: '2026-07-08', stage: 2 },
    }
    const out = settleBossFirstPass({
      progressRows: [row(key, { boxIndex: 2 })],
      firstPassResults: [{ wordKey: key, correct: false }],
      sinkResults: [{ wordKey: key, correct: true }],
      masteryByKey,
      consolidateExemptSet: new Set(),
      currentStats: stats(),
      today: TODAY,
    })
    expect(out.masteryPatches).toHaveLength(0)
    expect(out.masteryPatches.some(p => p.info.isHard)).toBe(false)
  })

  it('increments bossFailStreak and tier on first-pass <60%', () => {
    const out = settleBossFirstPass({
      progressRows: [row('a'), row('b'), row('c'), row('d'), row('e')],
      firstPassResults: [
        { wordKey: 'a', correct: true },
        { wordKey: 'b', correct: false },
        { wordKey: 'c', correct: false },
        { wordKey: 'd', correct: false },
        { wordKey: 'e', correct: false },
      ],
      masteryByKey: {},
      consolidateExemptSet: new Set(),
      currentStats: stats({ bossFailStreak: 1, bossQuestionTier: 2 }),
      today: TODAY,
    })
    expect(out.planStatsPatch.bossFailStreak).toBe(2)
    expect(out.planStatsPatch.bossQuestionTier).toBe(3)
  })

  it('resets bossFailStreak on pass >=85% with sink cleared', () => {
    const out = settleBossFirstPass({
      progressRows: [row('a'), row('b'), row('c'), row('d'), row('e'), row('f'), row('g')],
      firstPassResults: [
        { wordKey: 'a', correct: true },
        { wordKey: 'b', correct: true },
        { wordKey: 'c', correct: true },
        { wordKey: 'd', correct: true },
        { wordKey: 'e', correct: true },
        { wordKey: 'f', correct: true },
        { wordKey: 'g', correct: false },
      ],
      sinkResults: [{ wordKey: 'g', correct: true }],
      masteryByKey: {},
      consolidateExemptSet: new Set(),
      currentStats: stats({ bossFailStreak: 2, bossQuestionTier: 2 }),
      today: TODAY,
    })
    expect(out.planStatsPatch.bossFailStreak).toBe(0)
  })
})
