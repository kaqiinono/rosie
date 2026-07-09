'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { CalcLevel, CalcProblemState } from '@rosie/core'
import { applyAttempt, defaultProblemState } from '../utils/calc-apply-attempt'
import {
  calcProblemStateStore,
  levelToInt,
  PROBLEM_STATE_SELECT_COLS,
  problemStateToRow,
  rowToProblemState,
} from '../utils/calc-problem-state-store'
import { applyMasterySideEffects } from '../utils/calc-mastery-sync'

export { applyAttempt, calcProblemStateStore }

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
        .select(PROBLEM_STATE_SELECT_COLS)
        .eq('user_id', userId)
        .in('level', intLevels)
      const rows = (data ?? []) as Parameters<typeof rowToProblemState>[0][]
      calcProblemStateStore.patchSessionData(userId, (prev) => {
        const next = { ...prev }
        for (const r of rows) next[r.signature] = rowToProblemState(r)
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
      return stateRecord[signature] ?? defaultProblemState(signature, level)
    },
    [stateRecord],
  )

  const upsertStates = useCallback(
    async (nextStates: CalcProblemState[]) => {
      if (nextStates.length === 0 || !userId) return
      // Prefer mastery sync so mistakes stay in frame when promoting to mastered
      await applyMasterySideEffects(userId, {
        kind: 'main_path_states',
        states: nextStates,
        sessionNo: 0,
      })
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

// Re-export for callers that built rows manually
export { problemStateToRow }
