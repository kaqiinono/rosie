import { describe, expect, it } from 'vitest'
import { quizTypesForWord, resolveFamiliarityBox } from '../../../packages/english/src/utils/adaptivePlanQuizTypes'
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
