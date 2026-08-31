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
  validatePreparedResponse,
  validatePrepareRequest,
  type CalcFormulaDetailsRequest,
  type CalcFormulaDetailsResponse,
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
  const { data, error } = await supabase.rpc('get_calc_report_summary')
  if (error) throw error
  return data as CalcReportSummaryResponse
}

export async function getCalcFormulaDetails(
  request: CalcFormulaDetailsRequest,
): Promise<CalcFormulaDetailsResponse> {
  validateDetailsRequest(request)
  const { data, error } = await supabase.rpc('get_calc_formula_details', { p_request: request })
  if (error) throw error
  const response = data as CalcFormulaDetailsResponse
  if (response.items.length > request.limit)
    throw new Error('calc detail response exceeded page size')
  return response
}
