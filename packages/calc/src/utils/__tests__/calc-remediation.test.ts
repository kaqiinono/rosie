import { describe, expect, it } from 'vitest'
import type { CalcProblemState } from '@rosie/core'
import { recordRemediationCorrect, recordRemediationWrong } from '../calc-remediation'

function state(overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    signature: 'add(1,1)',
    level: 1,
    proficiency: 0,
    attemptCount: 0,
    appearanceCount: 0,
    recentResults: [],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  }
}

describe('unified remediation projection', () => {
  it('opens and refreshes remediation with the latest wrong summary', () => {
    const next = recordRemediationWrong(state({ remediationCorrectCount: 2 }), {
      at: '2026-08-31T01:00:00.000Z',
      sessionNo: 7,
      userAnswer: '3',
      answer: { kind: 'int', value: 2 },
      errorTag: 'careless',
    })
    expect(next).toMatchObject({
      needsRemediation: true,
      remediationCorrectCount: 0,
      lastWrongSessionNo: 7,
      lastUserAnswer: '3',
      lastAnswerJson: { kind: 'int', value: 2 },
      lastErrorTag: 'careless',
    })
  })

  it('clears remediation only after the configured consecutive-correct threshold', () => {
    let next = state({ needsRemediation: true, remediationCorrectCount: 0 })
    next = recordRemediationCorrect(next)
    expect(next.needsRemediation).toBe(true)
    next = recordRemediationCorrect(next)
    expect(next.needsRemediation).toBe(true)
    next = recordRemediationCorrect(next)
    expect(next).toMatchObject({ needsRemediation: false, remediationCorrectCount: 3 })
  })

  it('does not create remediation from unrelated correct attempts', () => {
    const prev = state()
    expect(recordRemediationCorrect(prev)).toBe(prev)
  })
})
