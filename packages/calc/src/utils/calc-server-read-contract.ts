import type { CalcProblemState, CalcQuestion, CalcSelectionReason } from '@rosie/core'

export const CALC_PREPARE_MAX_BLOCKS = 50
export const CALC_PREPARE_MAX_QUESTIONS = 200
export const CALC_DETAILS_MAX_PAGE_SIZE = 100

export type CalcFormulaDetailStatus =
  | 'missing'
  | 'learning'
  | 'within-target'
  | 'fluent'
  | 'mastered'
  | 'review-due'
  | 'remediation'

export interface PrepareCalcSessionRequest {
  blockIds: string[]
  mode: 'daily' | 'free' | 'mistakes'
  count: number
  expectedRevision: number
}

export interface PreparedCalcCandidate {
  question: CalcQuestion
  selectionReason: CalcSelectionReason
}

export interface CalcBlockSummary {
  blockId: string
  curriculumVersion: string
  universeSize: number
  coveredCount: number
  withinTargetCount: number
  fluentCount: number
  masteredCount: number
  reviewDueCount: number
  recentIndependentCorrect: number
  recentIndependentTotal: number
  stableCount: number
  tier: 'initial' | 'stabilized' | 'graduated'
  ready: boolean
  recovery: boolean
  appliedRevision: number
  healthStatus: 'healthy' | 'stale' | 'rebuild_required' | 'version_conflict'
}

export interface PrepareCalcSessionResponse {
  revision: number
  candidates: PreparedCalcCandidate[]
  blocks: CalcBlockSummary[]
}

export interface CalcReportSummaryResponse {
  revision: number
  blocks: CalcBlockSummary[]
}

export interface CalcFormulaDetailsRequest {
  blockId: string
  status: CalcFormulaDetailStatus
  cursor?: string
  limit: number
}

export interface CalcFormulaDetail {
  signature: string
  curriculumIndex?: number
  state?: CalcProblemState
}

export interface CalcFormulaDetailsResponse {
  items: CalcFormulaDetail[]
  nextCursor: string | null
  revision: number
}

function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('invalid calc revision')
}

export function validatePrepareRequest(request: PrepareCalcSessionRequest): void {
  if (
    request.blockIds.length === 0 ||
    request.blockIds.length > CALC_PREPARE_MAX_BLOCKS ||
    new Set(request.blockIds).size !== request.blockIds.length
  ) {
    throw new Error('invalid calc block selection')
  }
  if (
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > CALC_PREPARE_MAX_QUESTIONS
  ) {
    throw new Error('invalid calc candidate count')
  }
  assertRevision(request.expectedRevision)
}

export function validateDetailsRequest(request: CalcFormulaDetailsRequest): void {
  if (!request.blockId || request.blockId.length > 100) throw new Error('invalid calc block id')
  if (
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > CALC_DETAILS_MAX_PAGE_SIZE
  ) {
    throw new Error('invalid calc detail page size')
  }
  if (request.cursor !== undefined && request.cursor.length > 500) {
    throw new Error('invalid calc detail cursor')
  }
}

export function validatePreparedResponse(response: PrepareCalcSessionResponse): void {
  assertRevision(response.revision)
  if (response.candidates.length > CALC_PREPARE_MAX_QUESTIONS) {
    throw new Error('calc prepare response exceeded candidate limit')
  }
  if (response.blocks.length > CALC_PREPARE_MAX_BLOCKS) {
    throw new Error('calc prepare response exceeded block limit')
  }
}
