import { describe, expect, it } from 'vitest'
import type { QuestionLogEntry } from '@rosie/core'
import {
  CALC_SETTLEMENT_SCHEMA_VERSION,
  deriveSessionSummary,
  validateSettlementPayload,
  type CalcSettlementPayload,
} from '../calc-settlement-contract'

function entry(overrides: Partial<QuestionLogEntry> = {}): QuestionLogEntry {
  return {
    key: 'block:add:10',
    signature: 'add(1,1)',
    ms: 900,
    ok: true,
    finallyOk: true,
    occurrenceInSession: 1,
    intentionalRepeat: false,
    evidenceKind: 'independent',
    presentationKey: 'standard',
    firstAnswer: '2',
    finalAnswer: '2',
    answerJson: { kind: 'int', value: 2 },
    withinLimit: true,
    selectionReason: 'coverage',
    ...overrides,
  }
}

function payload(log: QuestionLogEntry[]): CalcSettlementPayload {
  return {
    idempotencyKey: '018fae48-7d8c-7b45-8f90-d0284dc0e301',
    expectedRevision: 0,
    clientSchemaVersion: CALC_SETTLEMENT_SCHEMA_VERSION,
    session: {
      date: '2026-08-31',
      startedAt: '2026-08-31T00:00:00.000Z',
      finishedAt: '2026-08-31T00:00:02.000Z',
      mode: 'daily',
      maxStreak: 1,
      topLevel: 1,
      coinsEarned: 1,
      questionLog: log,
    },
    problemStates: [],
  }
}

describe('calc settlement contract', () => {
  it('derives fixed session summaries from permanent question facts', () => {
    expect(
      deriveSessionSummary([
        entry(),
        entry({ signature: 'add(1,2)', ok: false, finallyOk: true, ms: 1500 }),
        entry({ signature: 'add(1,3)', ok: false, finallyOk: false, ms: 1100 }),
      ]),
    ).toEqual({ count: 3, correctCount: 1, retryCount: 1, wrongCount: 1, timeSpentSec: 4 })
  })

  it('accepts complete ordered evidence', () => {
    expect(validateSettlementPayload(payload([entry()]))).toMatchObject({ count: 1 })
  })

  it('rejects missing evidence and inconsistent occurrences', () => {
    expect(() => validateSettlementPayload(payload([entry({ evidenceKind: undefined })]))).toThrow(
      'incomplete calc question evidence',
    )
    expect(() =>
      validateSettlementPayload(
        payload([
          entry(),
          entry({ occurrenceInSession: 3, intentionalRepeat: true, selectionReason: 'weak' }),
        ]),
      ),
    ).toThrow('invalid question occurrence')
  })
})
