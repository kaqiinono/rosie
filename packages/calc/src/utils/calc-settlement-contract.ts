import type { CalcMode, CalcProblemState, CalcSession, QuestionLogEntry } from '@rosie/core'

export const CALC_SETTLEMENT_SCHEMA_VERSION = 1
export const CALC_SETTLEMENT_MAX_QUESTIONS = 500

export interface CalcSettlementPayload {
  idempotencyKey: string
  expectedRevision: number
  clientSchemaVersion: number
  session: Pick<
    CalcSession,
    | 'date'
    | 'startedAt'
    | 'finishedAt'
    | 'mode'
    | 'maxStreak'
    | 'topLevel'
    | 'coinsEarned'
  > & {
    challengeCorrect?: number
    questionTimesMs?: number[]
    questionLog: QuestionLogEntry[]
  }
  problemStates: CalcProblemState[]
}

export interface CalcSettlementResult {
  sessionId: string
  sessionNo: number
  revision: number
  idempotentReplay: boolean
}

export interface DerivedSessionSummary {
  count: number
  correctCount: number
  retryCount: number
  wrongCount: number
  timeSpentSec: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function deriveSessionSummary(log: QuestionLogEntry[]): DerivedSessionSummary {
  const correctCount = log.filter((entry) => entry.ok).length
  const retryCount = log.filter((entry) => !entry.ok && entry.finallyOk).length
  const wrongCount = log.filter((entry) => entry.finallyOk === false).length
  return {
    count: log.length,
    correctCount,
    retryCount,
    wrongCount,
    timeSpentSec: Math.round(log.reduce((total, entry) => total + entry.ms, 0) / 1000),
  }
}

function assertMode(mode: CalcMode): void {
  if (mode !== 'daily' && mode !== 'free' && mode !== 'mistakes') {
    throw new Error('invalid calc session mode')
  }
}

/** Client/server shared structural validation; authorization remains database-owned. */
export function validateSettlementPayload(payload: CalcSettlementPayload): DerivedSessionSummary {
  if (!UUID_PATTERN.test(payload.idempotencyKey)) throw new Error('invalid idempotency key')
  if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) {
    throw new Error('invalid expected revision')
  }
  if (payload.clientSchemaVersion !== CALC_SETTLEMENT_SCHEMA_VERSION) {
    throw new Error('unsupported calc settlement schema')
  }
  assertMode(payload.session.mode)
  const log = payload.session.questionLog
  if (log.length === 0 || log.length > CALC_SETTLEMENT_MAX_QUESTIONS) {
    throw new Error('invalid calc question count')
  }
  const occurrences = new Map<string, number>()
  for (const entry of log) {
    if (!entry.signature || entry.ms < 0 || !Number.isFinite(entry.ms)) {
      throw new Error('invalid calc question evidence')
    }
    if (!entry.evidenceKind || !entry.presentationKey || entry.finallyOk === undefined) {
      throw new Error('incomplete calc question evidence')
    }
    const occurrence = (occurrences.get(entry.signature) ?? 0) + 1
    occurrences.set(entry.signature, occurrence)
    if (entry.occurrenceInSession !== occurrence) throw new Error('invalid question occurrence')
    if ((entry.curriculumVersion === undefined) !== (entry.curriculumIndex === undefined)) {
      throw new Error('incomplete curriculum identity')
    }
    if (entry.curriculumIndex !== undefined && entry.curriculumIndex < 0) {
      throw new Error('invalid curriculum index')
    }
  }
  const uniqueStates = new Set(payload.problemStates.map((state) => state.signature))
  if (uniqueStates.size !== payload.problemStates.length) {
    throw new Error('duplicate problem-state transition')
  }
  return deriveSessionSummary(log)
}
