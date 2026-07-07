'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type {
  CalcAnswer,
  CalcCategory,
  CalcLevel,
  CalcMistake,
  CalcQuestion,
  ErrorTag,
} from '@rosie/core'
import { levelKey, parseLevelKey } from '../utils/calc-helpers'
import { answerFromRow, answerToNumeric } from '../utils/calc-answer'

interface MistakeRow {
  id: string
  signature: string
  display: string
  answer: number
  answer_json: CalcAnswer | null
  level: string
  category: CalcCategory
  last_wrong_at: string
  consecutive_correct: number
  resolved: boolean
  session_no: number | null
  user_answer: string | null
  error_tag: string | null
}

function rowToMistake(r: MistakeRow): CalcMistake {
  return {
    id: r.id,
    signature: r.signature,
    display: r.display,
    answer: answerFromRow(r.answer_json, r.answer),
    level: parseLevelKey(r.level),
    category: r.category,
    lastWrongAt: r.last_wrong_at,
    consecutiveCorrect: r.consecutive_correct,
    resolved: r.resolved,
    sessionNo: r.session_no ?? undefined,
    userAnswer: r.user_answer ?? undefined,
    errorTag: (r.error_tag as ErrorTag | null) ?? null,
  }
}

async function fetchCalcMistakes(userId: string): Promise<CalcMistake[]> {
  const { data } = await supabase
    .from('calc_mistakes')
    .select(
      'id,signature,display,answer,answer_json,level,category,last_wrong_at,consecutive_correct,resolved,session_no,user_answer,error_tag',
    )
    .eq('user_id', userId)
    .order('last_wrong_at', { ascending: false })
  return (data ?? []).map((r) => rowToMistake(r as MistakeRow))
}

export const calcMistakesStore = createUserSessionStore<CalcMistake[]>('calc_mistakes', {
  fetch: fetchCalcMistakes,
  empty: [],
})

export function useCalcMistakes(user: User | null) {
  const { data: mistakes, isLoading } = calcMistakesStore.useSessionData(user)

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
      try {
        await supabase.from('calc_mistakes').upsert(
          {
            user_id: user.id,
            signature: q.signature,
            display: q.display,
            answer: answerToNumeric(q.answer),
            answer_json: q.answer,
            level: levelKey(q.level),
            category: q.category,
            last_wrong_at: new Date().toISOString(),
            consecutive_correct: 0,
            resolved: false,
            session_no: sessionNo,
            user_answer: userAnswer ?? null,
            error_tag: errorTag ?? null,
          },
          { onConflict: 'user_id,signature' },
        )
      } catch {
        /* ignore */
      }
      calcMistakesStore.patchSessionData(user.id, (prev) => {
        const existing = prev.find((m) => m.signature === q.signature)
        if (existing) {
          return prev.map((m) =>
            m.signature === q.signature
              ? {
                  ...m,
                  consecutiveCorrect: 0,
                  resolved: false,
                  lastWrongAt: new Date().toISOString(),
                  sessionNo,
                  userAnswer,
                  errorTag,
                }
              : m,
          )
        }
        return [
          {
            signature: q.signature,
            display: q.display,
            answer: q.answer,
            level: q.level,
            category: q.category,
            lastWrongAt: new Date().toISOString(),
            consecutiveCorrect: 0,
            resolved: false,
            sessionNo,
            userAnswer,
            errorTag,
          },
          ...prev,
        ]
      })
    },
    [user],
  )

  const recordCorrect = useCallback(
    async (signature: string, sessionNo: number) => {
      if (!user) return
      const existing = mistakes.find((m) => m.signature === signature)
      if (!existing) return
      const nextCount = existing.consecutiveCorrect + 1
      const nextResolved = nextCount >= 3
      try {
        await supabase
          .from('calc_mistakes')
          .update({
            consecutive_correct: nextCount,
            resolved: nextResolved,
            session_no: sessionNo,
          })
          .eq('user_id', user.id)
          .eq('signature', signature)
      } catch {
        /* ignore */
      }
      calcMistakesStore.patchSessionData(user.id, (prev) =>
        prev.map((m) =>
          m.signature === signature
            ? { ...m, consecutiveCorrect: nextCount, resolved: nextResolved, sessionNo }
            : m,
        ),
      )
    },
    [user, mistakes],
  )

  const lastSessionUnresolved = useCallback(
    (prevSessionNo: number): CalcMistake[] =>
      mistakes.filter((m) => !m.resolved && m.sessionNo === prevSessionNo),
    [mistakes],
  )

  return { mistakes, addMistake, recordCorrect, refresh, lastSessionUnresolved, isLoading }
}

export type { CalcLevel }
