import { describe, expect, it } from 'vitest'
import {
  bossQuizTypesForWord,
  quizTypesForWord,
  resolveFamiliarityBox,
} from '../../../packages/english/src/utils/adaptivePlanQuizTypes'
import type { AdaptivePlanWordProgress } from '../../../packages/english/src/utils/adaptivePlanTypes'

function row(partial: Partial<AdaptivePlanWordProgress>): AdaptivePlanWordProgress {
  return {
    planId: 'p',
    userId: 'u',
    wordKey: 'w',
    status: 'LEARNING',
    boxIndex: 1,
    targetBox: null,
    streakWrong: 0,
    nextReviewDate: '2026-07-10',
    introducedOn: '2026-07-09',
    ...partial,
  }
}

describe('adaptivePlanQuizTypes', () => {
  it('maps box 1 → A only', () => {
    expect(quizTypesForWord(row({ boxIndex: 1 }))).toEqual(['A'])
  })

  it('maps box 2 → A,B and light → A', () => {
    expect(quizTypesForWord(row({ boxIndex: 2 }))).toEqual(['A', 'B'])
    expect(quizTypesForWord(row({ boxIndex: 2 }), undefined, { preferLight: true })).toEqual(['A'])
  })

  it('maps box 3 → B,C progressing to writing', () => {
    expect(quizTypesForWord(row({ boxIndex: 3 }))).toEqual(['B', 'C'])
  })

  it('maps box 4–5 → C writing exam', () => {
    expect(quizTypesForWord(row({ boxIndex: 4 }))).toEqual(['C'])
    expect(quizTypesForWord(row({ boxIndex: 5 }))).toEqual(['C'])
  })

  it('falls back to mastery stage when no box', () => {
    expect(resolveFamiliarityBox(undefined, { correct: 0, incorrect: 0, lastSeen: '', stage: 0 })).toBe(1)
    expect(resolveFamiliarityBox(undefined, { correct: 0, incorrect: 0, lastSeen: '', stage: 3 })).toBe(3)
    expect(resolveFamiliarityBox(undefined, { correct: 0, incorrect: 0, lastSeen: '', stage: 5 })).toBe(5)
  })
})

describe('bossQuizTypesForWord (§5.3.1 downgrade ladder)', () => {
  it('tier 1 = full pressure (high box → pure writing)', () => {
    expect(bossQuizTypesForWord(row({ boxIndex: 5 }), undefined, 1)).toEqual(['C'])
    expect(bossQuizTypesForWord(row({ boxIndex: 3 }), undefined, 1)).toEqual(['B', 'C'])
  })

  it('tier 2 = light pad before writing', () => {
    expect(bossQuizTypesForWord(row({ boxIndex: 5 }), undefined, 2)).toEqual(['B', 'C'])
    expect(bossQuizTypesForWord(row({ boxIndex: 3 }), undefined, 2)).toEqual(['A', 'C'])
  })

  it('tier 3 = floor (recognition + regular writing for high boxes)', () => {
    expect(bossQuizTypesForWord(row({ boxIndex: 5 }), undefined, 3)).toEqual(['A', 'C'])
    expect(bossQuizTypesForWord(row({ boxIndex: 3 }), undefined, 3)).toEqual(['A', 'B'])
    expect(bossQuizTypesForWord(row({ boxIndex: 1 }), undefined, 3)).toEqual(['A'])
  })

  it('clamps tiers outside 1–3 (no downgrade past the floor)', () => {
    expect(bossQuizTypesForWord(row({ boxIndex: 5 }), undefined, 0)).toEqual(['C'])
    expect(bossQuizTypesForWord(row({ boxIndex: 5 }), undefined, 7)).toEqual(['A', 'C'])
  })
})
