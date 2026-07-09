import { createUserSessionStore, supabase } from '@rosie/core'
import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '@rosie/core'
import { defaultProblemState } from './calc-apply-attempt'

export type ProblemStateRecord = Record<string, CalcProblemState>

interface ProblemStateRow {
  signature: string
  level: number
  proficiency: number
  attempt_count: number
  appearance_count: number
  recent_results: QuestionAttempt[]
  status: CalcProblemStatus
  consecutive_wrong: number
  consecutive_correct?: number | null
  last_within_limit?: boolean | null
  updated_at: string
  block_id?: string | null
  mixed_op_id?: string | null
}

export const PROBLEM_STATE_SELECT_COLS =
  'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,consecutive_wrong,consecutive_correct,last_within_limit,updated_at,block_id,mixed_op_id'

export function rowToProblemState(r: ProblemStateRow): CalcProblemState {
  return {
    signature: r.signature,
    level: r.level === 99 ? 'C' : r.level,
    proficiency: r.proficiency,
    attemptCount: r.attempt_count,
    appearanceCount: r.appearance_count,
    recentResults: Array.isArray(r.recent_results) ? r.recent_results : [],
    status: r.status,
    consecutiveWrong: r.consecutive_wrong,
    consecutiveCorrect: r.consecutive_correct ?? 0,
    lastWithinLimit: r.last_within_limit ?? null,
    updatedAt: r.updated_at,
    blockId: r.block_id ?? undefined,
    mixedOpId: r.mixed_op_id ?? undefined,
  }
}

export function levelToInt(level: CalcLevel): number {
  return level === 'C' ? 99 : level
}

export function problemStateToRow(s: CalcProblemState, userId: string) {
  return {
    user_id: userId,
    signature: s.signature,
    level: levelToInt(s.level),
    proficiency: s.proficiency,
    attempt_count: s.attemptCount,
    appearance_count: s.appearanceCount,
    recent_results: s.recentResults,
    status: s.status,
    consecutive_wrong: s.consecutiveWrong,
    consecutive_correct: s.consecutiveCorrect,
    last_within_limit: s.lastWithinLimit ?? null,
    updated_at: new Date().toISOString(),
    block_id: s.blockId ?? null,
    mixed_op_id: s.mixedOpId ?? null,
  }
}

async function fetchAllProblemStates(userId: string): Promise<ProblemStateRecord> {
  const { data } = await supabase
    .from('calc_problem_state')
    .select(PROBLEM_STATE_SELECT_COLS)
    .eq('user_id', userId)
  const record: ProblemStateRecord = {}
  for (const r of (data ?? []) as ProblemStateRow[]) {
    record[r.signature] = rowToProblemState(r)
  }
  return record
}

export const calcProblemStateStore = createUserSessionStore<ProblemStateRecord>(
  'calc_problem_states',
  {
    fetch: fetchAllProblemStates,
    empty: {},
  },
)

export { defaultProblemState }
