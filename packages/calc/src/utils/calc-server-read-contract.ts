import type { CalcProblemState, CalcSelectionReason } from '@rosie/core'

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
  state: CalcProblemState
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

export interface CalcReportBlockSummary extends CalcBlockSummary {
  coveredBits: string | null
  withinTargetBits: string | null
  fluentBits: string | null
  masteredBits: string | null
}

export interface CalcReportDetailSource {
  kind: 'block' | 'mixed'
  id: string
  formulaCount: number
}

export interface CalcReportAuxiliaryResponse {
  revision: number
  blocks: CalcReportBlockSummary[]
  detailSources: CalcReportDetailSource[]
}

export interface CalcStructureStabilityResponse {
  revision: number
  cells: Array<{ modelId: string; cellKey: string }>
}

export interface CalcConceptSummary {
  blockId: string
  observedTotal: number
  covered: number
  withinTarget: number
  fluent: number
  mastered: number
  reviewDue: number
}

export interface CalcStructureCellSummary {
  modelId: string
  cellKey: string
  covered: boolean
  fluent: boolean
  mastered: boolean
  reviewDue: boolean
  sampleSignatures: string[]
}

export interface CalcRuleSummary {
  ruleKey: string
  covered: number
  mastered: number
  sampleSignatures: string[]
}

export interface CalcReportProjectionHealth {
  version: number
  stateCount: number
  projectedStateCount: number
  expectedBlockCount: number
  projectedBlockCount: number
  complete: boolean
}

export interface CalcRepeatAuditSummary {
  questions: number
  repeats: number
  intentional: number
  accidental: number
  consecutive: number
}

export interface PrepareCalcSessionResponse {
  revision: number
  candidates: PreparedCalcCandidate[]
  blocks: CalcBlockSummary[]
}

export interface CalcReportSummaryResponse {
  revision: number
  projection: CalcReportProjectionHealth
  blocks: CalcReportBlockSummary[]
  concepts: CalcConceptSummary[]
  structures: CalcStructureCellSummary[]
  rules: CalcRuleSummary[]
  repeatAudit: CalcRepeatAuditSummary
  detailSources: CalcReportDetailSource[]
}

export interface CalcFormulaDetailsRequest {
  blockId: string
  sourceKind?: 'block' | 'mixed'
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

export function validateReportSummary(response: CalcReportSummaryResponse): void {
  assertRevision(response.revision)
  if (!response.projection || response.projection.version !== 1) {
    throw new Error('unsupported calc report projection')
  }
  if (
    !Array.isArray(response.blocks) ||
    !Array.isArray(response.concepts) ||
    !Array.isArray(response.structures) ||
    !Array.isArray(response.rules) ||
    !Array.isArray(response.detailSources) ||
    response.blocks.length > 100 ||
    response.concepts.length > 100 ||
    response.structures.length > 1000 ||
    response.rules.length > 100 ||
    response.detailSources.length > 200
  ) {
    throw new Error('invalid or unbounded calc report summary')
  }
  if (
    [
      response.projection.stateCount,
      response.projection.projectedStateCount,
      response.projection.expectedBlockCount,
      response.projection.projectedBlockCount,
    ].some((value) => !Number.isSafeInteger(value) || value < 0) ||
    !response.repeatAudit ||
    Object.values(response.repeatAudit).some((value) => !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error('invalid calc report counters')
  }
  const blockIds = new Set<string>()
  for (const block of response.blocks) {
    if (blockIds.has(block.blockId)) throw new Error('duplicate calc report block')
    blockIds.add(block.blockId)
    if (
      !Number.isSafeInteger(block.universeSize) ||
      block.universeSize <= 0 ||
      block.appliedRevision > response.revision ||
      [
        block.coveredCount,
        block.withinTargetCount,
        block.fluentCount,
        block.masteredCount,
        block.reviewDueCount,
        block.stableCount,
      ].some((value) => !Number.isSafeInteger(value) || value < 0 || value > block.universeSize)
    ) {
      throw new Error('invalid calc report block counters')
    }
    const bitmaps = [
      block.coveredBits,
      block.withinTargetBits,
      block.fluentBits,
      block.masteredBits,
    ]
    const present = bitmaps.filter((value): value is string => value !== null)
    if (present.length !== 0 && present.length !== bitmaps.length) {
      throw new Error('incomplete calc report bitmap set')
    }
    const expectedHexLength = Math.ceil(block.universeSize / 8) * 2
    if (
      present.some((value) => value.length !== expectedHexLength || !/^[0-9a-f]+$/i.test(value))
    ) {
      throw new Error('invalid calc report bitmap')
    }
  }
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
    request.sourceKind !== undefined &&
    request.sourceKind !== 'block' &&
    request.sourceKind !== 'mixed'
  ) {
    throw new Error('invalid calc detail source')
  }
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

export function validateDetailsResponse(
  response: CalcFormulaDetailsResponse,
  request: CalcFormulaDetailsRequest,
): void {
  assertRevision(response.revision)
  if (!Array.isArray(response.items) || response.items.length > request.limit) {
    throw new Error('calc detail response exceeded page size')
  }
  if (response.nextCursor !== null && typeof response.nextCursor !== 'string') {
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
