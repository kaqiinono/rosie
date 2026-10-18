import { describe, expect, it } from 'vitest'
import type { QuestionLogEntry } from '@rosie/core'
import { defaultProblemState } from '../calc-apply-attempt'
import { foldCalcSettlement } from '../calc-settlement-fold'

function entry(overrides: Partial<QuestionLogEntry>): QuestionLogEntry {
  return {
    key: 'block:add:10',
    signature: 'add(1,1)',
    level: 1,
    ms: 1000,
    finalMs: 1000,
    ok: false,
    finallyOk: false,
    evidenceKind: 'independent',
    presentationKey: 'standard',
    answerJson: { kind: 'int', value: 2 },
    finalAnswer: '3',
    sourceBlockId: 'add:10',
    ...overrides,
  }
}

describe('calc settlement fold', () => {
  it('uses the ordered answer log for mastery and remediation once', () => {
    const states = foldCalcSettlement(
      [
        entry({}),
        entry({
          ok: true,
          finallyOk: true,
          evidenceKind: 'makeup',
          finalAnswer: '2',
          withinLimit: true,
        }),
      ],
      new Map([['add(1,1)', defaultProblemState('add(1,1)', 1)]]),
      7,
      '2026-10-18',
      true,
    )

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      attemptCount: 2,
      lastWrongSessionNo: 7,
      needsRemediation: true,
      remediationCorrectCount: 1,
      blockId: 'add:10',
    })
    expect(states[0].recentResults.map((attempt) => attempt.evidenceKind)).toEqual([
      'independent',
      'makeup',
    ])
  })

  it('keeps drill mistakes out of the carry-over queue', () => {
    const [state] = foldCalcSettlement([entry({})], new Map(), 1, '2026-10-18', false)
    expect(state.needsRemediation).toBe(false)
    expect(state.attemptCount).toBe(1)
  })

  it('rejects unfinished evidence before any server write', () => {
    expect(() => foldCalcSettlement([entry({ finallyOk: undefined })], new Map(), 1, '2026-10-18', true))
      .toThrow('incomplete calc settlement log')
  })
})
