import { describe, expect, it } from 'vitest'
import type { CalcProblemState, QuestionAttempt } from '@rosie/core'
import {
  learningStatusFromEvidence,
  nextMasteryTransition,
} from '../../../packages/calc/src/utils/calc-mastery'
import {
  calculateBlockCoverage,
  coverageUniverse,
} from '../../../packages/calc/src/utils/calc-coverage'

function ind(sessionNo: number, date: string, overrides: Partial<QuestionAttempt> = {}): QuestionAttempt {
  return {
    correct: true,
    timeMs: 1000,
    withinLimit: true,
    evidenceKind: 'independent',
    sessionNo,
    date,
    ...overrides,
  }
}

function state(recentResults: QuestionAttempt[], overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    signature: 'add(1,2)',
    level: 1,
    proficiency: 0,
    attemptCount: recentResults.length,
    appearanceCount: recentResults.length,
    recentResults,
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('learningStatusFromEvidence transitions', () => {
  it('needs >=3 qualified across >=2 sessions for fluent', () => {
    const fluent = state([ind(1, '2026-01-01'), ind(2, '2026-01-01'), ind(3, '2026-01-01')])
    expect(learningStatusFromEvidence(fluent)).toBe('fluent')
  })

  it('3 qualified in a single session stays learning', () => {
    const single = state([ind(1, '2026-01-01'), ind(1, '2026-01-01'), ind(1, '2026-01-01')])
    expect(learningStatusFromEvidence(single)).toBe('learning')
  })

  it('only 2 qualified stays learning', () => {
    const two = state([ind(1, '2026-01-01'), ind(2, '2026-01-01')])
    expect(learningStatusFromEvidence(two)).toBe('learning')
  })

  it('ordinary independent practice on a later date stays fluent', () => {
    const fluent = state([ind(1, '2026-01-01'), ind(2, '2026-01-01'), ind(3, '2026-01-02')])
    expect(learningStatusFromEvidence(fluent)).toBe('fluent')
  })

  it('fluent on a single date stays fluent', () => {
    const fluent = state([ind(1, '2026-01-01'), ind(2, '2026-01-01'), ind(3, '2026-01-01')])
    expect(learningStatusFromEvidence(fluent)).toBe('fluent')
  })
})

describe('regression to review-due', () => {
  it('a wrong latest attempt on fluent evidence triggers review-due', () => {
    const s = state(
      [ind(1, '2026-01-01'), ind(2, '2026-01-01'), ind(3, '2026-01-02'), ind(4, '2026-01-03', { correct: false, withinLimit: false })],
    )
    expect(learningStatusFromEvidence(s)).toBe('review-due')
  })

  it('a wrong latest attempt without fluent evidence stays learning', () => {
    const s = state([ind(1, '2026-01-01'), ind(2, '2026-01-01', { correct: false, withinLimit: false })], {
      proficiency: 0,
    })
    expect(learningStatusFromEvidence(s)).toBe('learning')
  })
})

describe('makeup exclusion', () => {
  it('same-session makeup never establishes fluency or mastery', () => {
    const makeup = [1, 2, 3].map((n) => ind(n, `2026-01-0${n}`, { evidenceKind: 'makeup' }))
    expect(learningStatusFromEvidence(state(makeup))).toBe('learning')
  })
})

describe('recall as mastery evidence', () => {
  it('recall counts toward mastery transitions', () => {
    const s = state([
      ind(1, '2026-01-01'),
      ind(2, '2026-01-01'),
      ind(3, '2026-01-01'),
      ind(4, '2026-01-02', { evidenceKind: 'recall' }),
    ])
    expect(learningStatusFromEvidence(s)).toBe('mastered')
  })
})

describe('coverage vs mastery distinction', () => {
  const universe = coverageUniverse('add:10')!

  it('recall-only state is not mastered and is NOT counted as covered', () => {
    const sig = universe.signatureAt(0)
    const recallOnly = state(
      [
        ind(1, '2026-01-01', { evidenceKind: 'recall' }),
        ind(2, '2026-01-01', { evidenceKind: 'recall' }),
        ind(3, '2026-01-02', { evidenceKind: 'recall' }),
      ],
      { signature: sig },
    )
    const result = calculateBlockCoverage(universe, new Map([[sig, recallOnly]]))
    expect(result.mastered).toBe(0)
    expect(result.covered).toBe(0)
    expect(result.missingSignatures).toContain(sig)
  })

  it('independent-attempt state is covered', () => {
    const sig = universe.signatureAt(1)
    const s = state([ind(1, '2026-01-01')], { signature: sig })
    const result = calculateBlockCoverage(universe, new Map([[sig, s]]))
    expect(result.covered).toBe(1)
  })

  it('makeup-only state is not covered', () => {
    const sig = universe.signatureAt(2)
    const s = state([ind(1, '2026-01-01', { evidenceKind: 'makeup' })], { signature: sig })
    const result = calculateBlockCoverage(universe, new Map([[sig, s]]))
    expect(result.covered).toBe(0)
  })

  it('legacy state with no recentResults falls back to appearanceCount', () => {
    const sig = universe.signatureAt(3)
    const legacy = state([], { signature: sig, appearanceCount: 5 })
    const result = calculateBlockCoverage(universe, new Map([[sig, legacy]]))
    expect(result.covered).toBe(1)
  })
})

describe('nextMasteryTransition proficiency rules', () => {
  const base = (overrides: Partial<CalcProblemState> = {}): CalcProblemState => state([], overrides)

  it('correct within-limit independent attempt raises proficiency', () => {
    const attempt = ind(1, '2026-01-01')
    const result = nextMasteryTransition(base({ proficiency: 2 }), [attempt], attempt)
    expect(result.proficiency).toBe(3)
    expect(result.consecutiveCorrect).toBe(1)
  })

  it('makeup correct does not raise proficiency', () => {
    const attempt = ind(1, '2026-01-01', { evidenceKind: 'makeup' })
    const result = nextMasteryTransition(base({ proficiency: 2 }), [attempt], attempt)
    expect(result.proficiency).toBe(2)
  })

  it('wrong attempt drops proficiency by 2 and increments consecutiveWrong', () => {
    const attempt: QuestionAttempt = { correct: false, timeMs: 1000, evidenceKind: 'independent' }
    const result = nextMasteryTransition(base({ proficiency: 3 }), [attempt], attempt)
    expect(result.proficiency).toBe(1)
    expect(result.consecutiveWrong).toBe(1)
  })

  it('correct but slow attempt lowers proficiency and marks lagging', () => {
    const attempt: QuestionAttempt = {
      correct: true,
      withinLimit: false,
      timeMs: 9999,
      evidenceKind: 'independent',
    }
    const result = nextMasteryTransition(base({ proficiency: 3 }), [attempt], attempt)
    expect(result.proficiency).toBe(2)
    expect(result.status).toBe('lagging')
  })
})
