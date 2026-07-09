'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import type { CalcLevel, CalcMistake, CalcQuestion, ErrorTag } from '@rosie/core'
import { calcMistakesStore } from '../utils/calc-mistakes-store'
import { calcProblemStateStore } from '../utils/calc-problem-state-store'
import {
  applyMasterySideEffects,
  unresolvedMistakes,
} from '../utils/calc-mastery-sync'

export { calcMistakesStore }

export function useCalcMistakes(user: User | null) {
  const { data: mistakes, isLoading } = calcMistakesStore.useSessionData(user)
  const { data: stateRecord } = calcProblemStateStore.useSessionData(user)

  const states = useMemo(() => new Map(Object.entries(stateRecord)), [stateRecord])

  const refresh = useCallback(async () => {
    if (!user) return
    calcMistakesStore.invalidate(user.id)
    calcMistakesStore.ensureLoaded(user.id)
  }, [user])

  const addMistake = useCallback(
    async (
      q: CalcQuestion,
      sessionNo: number,
      userAnswer?: string,
      errorTag?: ErrorTag | null,
    ) => {
      if (!user) return
      await applyMasterySideEffects(user.id, {
        kind: 'mistake_added',
        question: q,
        sessionNo,
        userAnswer,
        errorTag,
      })
    },
    [user],
  )

  const recordCorrect = useCallback(
    async (signature: string, sessionNo: number, level: CalcLevel = 1) => {
      if (!user) return
      const existing = mistakes.find((m) => m.signature === signature)
      if (!existing) return
      await applyMasterySideEffects(user.id, {
        kind: 'mistake_correct',
        signature,
        sessionNo,
        level: existing.level ?? level,
      })
    },
    [user, mistakes],
  )

  const lastSessionUnresolved = useCallback(
    (prevSessionNo: number): CalcMistake[] =>
      unresolvedMistakes(mistakes, states).filter((m) => m.sessionNo === prevSessionNo),
    [mistakes, states],
  )

  const unresolved = useMemo(
    () => unresolvedMistakes(mistakes, states),
    [mistakes, states],
  )

  return {
    mistakes,
    unresolved,
    addMistake,
    recordCorrect,
    refresh,
    lastSessionUnresolved,
    isLoading,
  }
}

export type { CalcLevel }
