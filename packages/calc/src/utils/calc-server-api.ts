import { supabase } from '@rosie/core'
import { problemStateToRow } from './calc-problem-state-store'
import { snapshotMutationItems } from './calc-curriculum-snapshot'
import {
  validateSettlementPayload,
  type CalcSettlementPayload,
  type CalcSettlementResult,
} from './calc-settlement-contract'
import {
  validateDetailsRequest,
  validateDetailsResponse,
  validatePreparedResponse,
  validatePrepareRequest,
  validateReportSummary,
  type CalcFormulaDetailsRequest,
  type CalcFormulaDetailsResponse,
  type CalcReportAuxiliaryResponse,
  type CalcStructureStabilityResponse,
  type CalcReportSummaryResponse,
  type PrepareCalcSessionRequest,
  type PrepareCalcSessionResponse,
} from './calc-server-read-contract'

export async function getCalcRuntimeRevision(): Promise<number> {
  const { data, error } = await supabase
    .from('calc_user_runtime')
    .select('state_revision')
    .maybeSingle()
  if (error) throw error
  return typeof data?.state_revision === 'number' ? data.state_revision : 0
}

export async function settleCalcSession(
  userId: string,
  payload: CalcSettlementPayload,
): Promise<CalcSettlementResult> {
  validateSettlementPayload(payload)
  const session = payload.session
  const { data, error } = await supabase.rpc('settle_calc_session', {
    p_payload: {
      idempotency_key: payload.idempotencyKey,
      expected_revision: payload.expectedRevision,
      client_schema_version: payload.clientSchemaVersion,
      reward_delta: session.coinsEarned,
      session: {
        date: session.date,
        started_at: session.startedAt,
        finished_at: session.finishedAt,
        mode: session.mode,
        max_streak: session.maxStreak,
        top_level: session.topLevel,
        challenge_correct: session.challengeCorrect,
        question_times_ms: session.questionTimesMs ?? [],
        question_log: session.questionLog,
      },
      problem_states: payload.problemStates.map((state) => problemStateToRow(state, userId)),
      progress_items: snapshotMutationItems(payload.problemStates),
    },
  })
  if (error) throw error
  return data as CalcSettlementResult
}

export async function prepareCalcSession(
  request: PrepareCalcSessionRequest,
): Promise<PrepareCalcSessionResponse> {
  validatePrepareRequest(request)
  const { data, error } = await supabase.rpc('prepare_calc_session', { p_request: request })
  if (error) throw error
  const response = data as PrepareCalcSessionResponse
  validatePreparedResponse(response)
  return response
}

export async function getCalcReportSummary(): Promise<CalcReportSummaryResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const [summaryResult, auxiliaryResult, stabilityResult] = await Promise.all([
      supabase.rpc('get_calc_report_summary'),
      supabase.rpc('get_calc_report_auxiliary'),
      supabase.rpc('get_calc_structure_stability'),
    ])
    if (summaryResult.error) throw summaryResult.error
    if (auxiliaryResult.error) throw auxiliaryResult.error
    if (stabilityResult.error) throw stabilityResult.error
    const summary = summaryResult.data as Omit<CalcReportSummaryResponse, 'detailSources'>
    const auxiliary = auxiliaryResult.data as CalcReportAuxiliaryResponse
    const stability = stabilityResult.data as CalcStructureStabilityResponse
    if (summary.revision !== auxiliary.revision || summary.revision !== stability.revision) continue
    if (!Array.isArray(stability.cells) || stability.cells.length > 1000) {
      throw new Error('invalid or unbounded calc structure stability')
    }
    const stableByModel = new Map<string, number>()
    const stableCellIds = new Set<string>()
    for (const cell of stability.cells) {
      const id = `${cell.modelId}\u0000${cell.cellKey}`
      if (!cell.modelId || !cell.cellKey || stableCellIds.has(id)) {
        throw new Error('invalid calc structure stability cell')
      }
      stableCellIds.add(id)
      stableByModel.set(cell.modelId, (stableByModel.get(cell.modelId) ?? 0) + 1)
    }
    const abilityBlocks = auxiliary.blocks.map((block) => {
      const stableCount = stableByModel.get(block.blockId) ?? 0
      const recentAccuracy =
        block.recentIndependentTotal > 0
          ? block.recentIndependentCorrect / block.recentIndependentTotal
          : 1
      const ready =
        block.coveredCount / block.universeSize >= 0.9 &&
        recentAccuracy >= 0.85 &&
        stableCount / block.universeSize >= 0.75 &&
        block.fluentCount / block.universeSize >= 0.6
      const recovery =
        block.recentIndependentTotal > 0 &&
        (recentAccuracy < 0.7 || block.reviewDueCount / block.universeSize > 0.15)
      return { ...block, stableCount, ready, recovery }
    })
    const response: CalcReportSummaryResponse = {
      ...summary,
      blocks: [...summary.blocks, ...abilityBlocks],
      detailSources: auxiliary.detailSources,
    }
    validateReportSummary(response)
    return response
  }
  throw new Error('calc report revision changed during load')
}

export async function getCalcFormulaDetails(
  request: CalcFormulaDetailsRequest,
): Promise<CalcFormulaDetailsResponse> {
  validateDetailsRequest(request)
  const { data, error } = await supabase.rpc('get_calc_formula_details', { p_request: request })
  if (error) throw error
  const response = data as CalcFormulaDetailsResponse
  validateDetailsResponse(response, request)
  return response
}
