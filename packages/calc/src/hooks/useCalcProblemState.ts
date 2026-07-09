'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '@rosie/core'
import { MASTERY_STREAK_K } from '../utils/calc-effective-limit'

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

const SELECT_COLS =
  'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,consecutive_wrong,consecutive_correct,last_within_limit,updated_at,block_id,mixed_op_id'

function rowToState(r: ProblemStateRow): CalcProblemState {
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

function levelToInt(level: CalcLevel): number {
  return level === 'C' ? 99 : level
}

function stateToRow(s: CalcProblemState, userId: string) {
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

function defaultState(signature: string, level: CalcLevel): CalcProblemState {
  return {
    signature,
    level,
    proficiency: 0,
    attemptCount: 0,
    appearanceCount: 0,
    recentResults: [],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
    lastWithinLimit: null,
    updatedAt: new Date().toISOString(),
  }
}

const RECENT_CAP = 10

export function applyAttempt(
  prev: CalcProblemState,
  attempt: QuestionAttempt,
  withinLimit: boolean,
  _sessionNo: number,
  _today: string,
): CalcProblemState {
  const attemptWithLimit: QuestionAttempt = { ...attempt, withinLimit }
  const nextRecent = [...prev.recentResults, attemptWithLimit].slice(-RECENT_CAP)
  const nextAttemptCount = prev.attemptCount + 1

  let nextProf = prev.proficiency
  let nextConsecutiveWrong = prev.consecutiveWrong
  let nextConsecutiveCorrect = prev.consecutiveCorrect ?? 0
  let nextStatus: CalcProblemStatus = prev.status === 'forced' ? 'forced' : 'active'

  if (attempt.correct && withinLimit) {
    nextProf = Math.min(5, nextProf + 1)
    nextConsecutiveWrong = 0
    nextConsecutiveCorrect = nextConsecutiveCorrect + 1
    if (nextConsecutiveCorrect >= MASTERY_STREAK_K && nextAttemptCount >= MASTERY_STREAK_K) {
      nextStatus = 'mastered'
    } else {
      nextStatus = 'active'
    }
  } else if (attempt.correct && !withinLimit) {
    // Lagging = soft-fail: clear streak, drop one proficiency band, mark lagging.
    nextProf = Math.max(0, nextProf - 1)
    nextConsecutiveWrong = 0
    nextConsecutiveCorrect = 0
    nextStatus = 'lagging'
  } else {
    nextProf = Math.max(0, nextProf - 2)
    nextConsecutiveWrong = prev.consecutiveWrong + 1
    nextConsecutiveCorrect = 0
    nextStatus = 'active'
  }

  return {
    ...prev,
    proficiency: nextProf,
    attemptCount: nextAttemptCount,
    appearanceCount: prev.appearanceCount + 1,
    recentResults: nextRecent,
    status: nextStatus,
    consecutiveWrong: nextConsecutiveWrong,
    consecutiveCorrect: nextConsecutiveCorrect,
    lastWithinLimit: withinLimit,
    updatedAt: new Date().toISOString(),
  }
}

type ProblemStateRecord = Record<string, CalcProblemState>

async function fetchAllProblemStates(userId: string): Promise<ProblemStateRecord> {
  const { data } = await supabase
    .from('calc_problem_state')
    .select(SELECT_COLS)
    .eq('user_id', userId)
  const record: ProblemStateRecord = {}
  for (const r of (data ?? []) as ProblemStateRow[]) {
    record[r.signature] = rowToState(r)
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

export interface UseCalcProblemStateReturn {
  states: Map<string, CalcProblemState>
  isLoading: boolean
  loadForLevels: (levels: CalcLevel[]) => Promise<void>
  loadAll: () => Promise<Map<string, CalcProblemState>>
  getState: (signature: string, level: CalcLevel) => CalcProblemState
  upsertStates: (next: CalcProblemState[]) => Promise<void>
}

export function useCalcProblemState(user: User | null): UseCalcProblemStateReturn {
  const userId = user?.id ?? null
  const { data: stateRecord, isLoading } = calcProblemStateStore.useSessionData(user)

  const states = useMemo(() => new Map(Object.entries(stateRecord)), [stateRecord])

  const loadForLevels = useCallback(
    async (levels: CalcLevel[]) => {
      if (!userId || levels.length === 0) return
      if (calcProblemStateStore.getSessionData(userId)) {
        return
      }
      const intLevels = levels.map(levelToInt)
      const { data } = await supabase
        .from('calc_problem_state')
        .select(SELECT_COLS)
        .eq('user_id', userId)
        .in('level', intLevels)
      const rows = (data ?? []) as ProblemStateRow[]
      calcProblemStateStore.patchSessionData(userId, (prev) => {
        const next = { ...prev }
        for (const r of rows) next[r.signature] = rowToState(r)
        return next
      })
    },
    [userId],
  )

  const loadAll = useCallback(async (): Promise<Map<string, CalcProblemState>> => {
    if (!userId) return new Map()
    await calcProblemStateStore.ensureLoaded(userId)
    const loaded = calcProblemStateStore.getSessionData(userId) ?? {}
    return new Map(Object.entries(loaded))
  }, [userId])

  const getState = useCallback(
    (signature: string, level: CalcLevel): CalcProblemState => {
      return stateRecord[signature] ?? defaultState(signature, level)
    },
    [stateRecord],
  )

  const upsertStates = useCallback(
    async (nextStates: CalcProblemState[]) => {
      if (nextStates.length === 0) return
      if (userId) {
        calcProblemStateStore.patchSessionData(userId, (prev) => {
          const next = { ...prev }
          for (const s of nextStates) next[s.signature] = s
          return next
        })
        const rows = nextStates.map((s) => stateToRow(s, userId))
        try {
          await supabase
            .from('calc_problem_state')
            .upsert(rows, { onConflict: 'user_id,signature' })
        } catch {
          /* ignore */
        }
      }
    },
    [userId],
  )

  return useMemo(
    () => ({
      states,
      isLoading,
      loadForLevels,
      loadAll,
      getState,
      upsertStates,
    }),
    [states, isLoading, loadForLevels, loadAll, getState, upsertStates],
  )
}
