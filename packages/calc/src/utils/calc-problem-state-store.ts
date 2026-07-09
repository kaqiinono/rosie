import { createUserSessionStore, supabase } from '@rosie/core'
import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '@rosie/core'
import { defaultProblemState } from './calc-apply-attempt'
import { MASTERY_STREAK_K } from './calc-effective-limit'

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

/** On-load lazy grandfather — memory only; upsert on next settle. */
export function grandfatherInMemory(s: CalcProblemState): CalcProblemState {
  const needs =
    s.proficiency >= 4 &&
    s.attemptCount >= 3 &&
    (s.consecutiveCorrect ?? 0) === 0 &&
    s.status !== 'lagging'
  if (!needs) return s
  return {
    ...s,
    status: 'mastered',
    consecutiveCorrect: MASTERY_STREAK_K,
  }
}

export function rowToProblemState(r: ProblemStateRow): CalcProblemState {
  return grandfatherInMemory({
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
  })
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

/**
 * Truncated mastered recall candidates (LIMIT recallSlot*3), then score in memory.
 * Avoids sorting the full mastered set in JS.
 */
export async function fetchMasteredRecallCandidates(
  userId: string,
  blockIds: string[],
  recallSlot: number,
): Promise<CalcProblemState[]> {
  if (blockIds.length === 0 || recallSlot <= 0) return []
  const limit = Math.max(recallSlot * 3, 3)
  const { data, error } = await supabase
    .from('calc_problem_state')
    .select(PROBLEM_STATE_SELECT_COLS)
    .eq('user_id', userId)
    .eq('status', 'mastered')
    .in('block_id', blockIds)
    .order('updated_at', { ascending: true })
    .limit(limit)
  if (error || !data) return []
  return (data as ProblemStateRow[])
    .map(rowToProblemState)
    .sort((a, b) => {
      const score = (s: CalcProblemState) => {
        const ageDays = Math.max(0, (Date.now() - new Date(s.updatedAt).getTime()) / 86400000)
        return ageDays * 2 + Math.max(0, 12 - s.attemptCount) * 3
      }
      return score(b) - score(a)
    })
}

export { defaultProblemState }
