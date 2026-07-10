import { describe, it, expect } from 'vitest'
import type { CalcMistake, CalcProblemState } from '../../../packages/core/src/type'
import {
  pullBackFromMastered,
  unresolvedMistakes,
  reconcileMistakesAndStates,
  foldAttempts,
} from '../../../packages/calc/src/utils/calc-mastery-sync'
import { applyAttempt, defaultProblemState } from '../../../packages/calc/src/utils/calc-apply-attempt'

const LEVEL = 20

function state(overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    ...defaultProblemState('3+4', LEVEL),
    ...overrides,
  }
}

function mistake(overrides: Partial<CalcMistake> = {}): CalcMistake {
  return {
    signature: '3+4',
    display: '3 + 4',
    answer: { kind: 'int', value: 7 },
    level: LEVEL,
    category: 'addsub',
    lastWrongAt: '2026-07-09T00:00:00Z',
    consecutiveCorrect: 0,
    resolved: false,
    ...overrides,
  }
}

describe('pullBackFromMastered (in-session wrong)', () => {
  it('resets streak and status but leaves proficiency untouched', () => {
    const prev = state({ proficiency: 5, consecutiveCorrect: 3, status: 'mastered' })
    const next = pullBackFromMastered(prev)
    expect(next.proficiency).toBe(5)
    expect(next.consecutiveCorrect).toBe(0)
    expect(next.status).toBe('active')
  })

  it('single wrong answer costs exactly -2 after the session fold (no double penalty)', () => {
    const prev = state({ proficiency: 5, consecutiveCorrect: 3, status: 'mastered' })
    // What settleQuestion does at answer time…
    const pulled = pullBackFromMastered(prev)
    // …and what the finish fold does with the attempt.
    const folded = applyAttempt(pulled, { correct: false, timeMs: 3000, withinLimit: true }, true, 1, '2026-07-09')
    expect(folded.proficiency).toBe(3)
  })
})

describe('unresolvedMistakes', () => {
  it('drops resolved and mastered-state mistakes', () => {
    const states = { '3+4': state({ status: 'mastered' }) }
    const list = [
      mistake(),
      mistake({ signature: '5+6', display: '5 + 6' }),
      mistake({ signature: '7+8', display: '7 + 8', resolved: true }),
    ]
    const out = unresolvedMistakes(list, states)
    expect(out.map((m) => m.signature)).toEqual(['5+6'])
  })
})

describe('reconcileMistakesAndStates', () => {
  it('demotes mastered with -2 when a newer wrong exists (cross-session repair)', () => {
    const states = {
      '3+4': state({ status: 'mastered', proficiency: 5, updatedAt: '2026-07-08T00:00:00Z' }),
    }
    const out = reconcileMistakesAndStates([mistake({ lastWrongAt: '2026-07-09T00:00:00Z' })], states)
    expect(out.states['3+4'].status).toBe('active')
    expect(out.states['3+4'].proficiency).toBe(3)
    expect(out.dirtySignatures).toEqual(['3+4'])
  })

  it('resolves hanging mistakes when the state is already mastered and newer', () => {
    const states = {
      '3+4': state({ status: 'mastered', proficiency: 5, updatedAt: '2026-07-10T00:00:00Z' }),
    }
    const out = reconcileMistakesAndStates([mistake({ lastWrongAt: '2026-07-09T00:00:00Z' })], states)
    expect(out.mistakes[0].resolved).toBe(true)
    expect(out.states['3+4'].proficiency).toBe(5)
  })
})

describe('foldAttempts', () => {
  it('reaches mastered after 3 within-limit corrects', () => {
    const attempts = Array.from({ length: 3 }, () => ({ correct: true, timeMs: 2000, withinLimit: true }))
    const out = foldAttempts(state(), attempts, 1, '2026-07-09')
    expect(out.status).toBe('mastered')
    expect(out.consecutiveCorrect).toBe(3)
  })

  it('correct-but-slow marks lagging and costs -1', () => {
    const out = foldAttempts(
      state({ proficiency: 3 }),
      [{ correct: true, timeMs: 20000, withinLimit: false }],
      1,
      '2026-07-09',
    )
    expect(out.status).toBe('lagging')
    expect(out.proficiency).toBe(2)
  })
})
