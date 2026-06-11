'use client'

import { useCallback, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '@/utils/type'

// ─────────────────────────────────────────────────────────────────────
// Row mapping
// ─────────────────────────────────────────────────────────────────────

interface ProblemStateRow {
  signature: string
  level: number
  proficiency: number
  attempt_count: number
  appearance_count: number
  recent_results: QuestionAttempt[]
  status: CalcProblemStatus
  consecutive_wrong: number
  updated_at: string
  block_id?: string | null
  mixed_op_id?: string | null
}

const SELECT_COLS =
  'signature,level,proficiency,attempt_count,appearance_count,recent_results,status,consecutive_wrong,updated_at,block_id,mixed_op_id'

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
    updated_at: new Date().toISOString(),
    block_id: s.blockId ?? null,
    mixed_op_id: s.mixedOpId ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

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
    updatedAt: new Date().toISOString(),
  }
}

const RECENT_CAP = 10

/** Pure: applies one attempt outcome to a state, returning the next state.
 *
 *  Lightweight 0–5 proficiency model (no spaced-repetition scheduling):
 *    - correct within limit → proficiency +1 (cap 5)
 *    - correct over limit   → proficiency +0.5 (rounded, cap 5)
 *    - wrong                → proficiency -2 (floor 0); consecutiveWrong +1
 *    - status 'mastered' when proficiency ≥ 4 and attemptCount ≥ 3, else 'active'
 *
 *  `sessionNo` / `today` are accepted for caller-signature stability but unused.
 */
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
  if (attempt.correct) {
    nextProf = withinLimit
      ? Math.min(5, nextProf + 1)
      : Math.min(5, Math.round(nextProf + 0.5))
    nextConsecutiveWrong = 0
  } else {
    nextProf = Math.max(0, nextProf - 2)
    nextConsecutiveWrong = prev.consecutiveWrong + 1
  }

  const nextStatus: CalcProblemStatus =
    nextProf >= 4 && nextAttemptCount >= 3 ? 'mastered' : 'active'

  return {
    ...prev,
    proficiency: nextProf,
    attemptCount: nextAttemptCount,
    appearanceCount: prev.appearanceCount + 1,
    recentResults: nextRecent,
    status: nextStatus,
    consecutiveWrong: nextConsecutiveWrong,
    updatedAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────

export interface UseCalcProblemStateReturn {
  states: Map<string, CalcProblemState>
  isLoading: boolean
  /** Load (or refresh) state for the given levels. */
  loadForLevels: (levels: CalcLevel[]) => Promise<void>
  /** Load all problem states for the user (no level filter), into `states`. */
  loadAll: () => Promise<void>
  /** Returns a per-signature state, synthesizing a fresh default for unseen entries. */
  getState: (signature: string, level: CalcLevel) => CalcProblemState
  /** Persist a batch of state mutations. Local map updates immediately. */
  upsertStates: (next: CalcProblemState[]) => Promise<void>
}

export function useCalcProblemState(user: User | null): UseCalcProblemStateReturn {
  const [states, setStates] = useState<Map<string, CalcProblemState>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const userId = user?.id ?? null

  const loadForLevels = useCallback(
    async (levels: CalcLevel[]) => {
      if (!userId || levels.length === 0) return
      setIsLoading(true)
      const intLevels = levels.map(levelToInt)
      const { data } = await supabase
        .from('calc_problem_state')
        .select(SELECT_COLS)
        .eq('user_id', userId)
        .in('level', intLevels)
      const rows = (data ?? []) as ProblemStateRow[]
      setStates((prev) => {
        const next = new Map(prev)
        for (const r of rows) next.set(r.signature, rowToState(r))
        return next
      })
      setIsLoading(false)
    },
    [userId],
  )

  const loadAll = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const { data } = await supabase
      .from('calc_problem_state')
      .select(SELECT_COLS)
      .eq('user_id', userId)
    const rows = (data ?? []) as ProblemStateRow[]
    setStates((prev) => {
      const next = new Map(prev)
      for (const r of rows) next.set(r.signature, rowToState(r))
      return next
    })
    setIsLoading(false)
  }, [userId])

  const getState = useCallback(
    (signature: string, level: CalcLevel): CalcProblemState => {
      return states.get(signature) ?? defaultState(signature, level)
    },
    [states],
  )

  const upsertStates = useCallback(
    async (nextStates: CalcProblemState[]) => {
      if (nextStates.length === 0) return
      // optimistic local update
      setStates((prev) => {
        const next = new Map(prev)
        for (const s of nextStates) next.set(s.signature, s)
        return next
      })
      if (!userId) return
      const rows = nextStates.map((s) => stateToRow(s, userId))
      try {
        await supabase
          .from('calc_problem_state')
          .upsert(rows, { onConflict: 'user_id,signature' })
      } catch {
        /* ignore */
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
