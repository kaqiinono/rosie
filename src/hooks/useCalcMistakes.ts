'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcCategory, CalcLevel, CalcMistake, CalcQuestion } from '@/utils/type'
import { levelKey, parseLevelKey } from '@/utils/calc-helpers'

interface MistakeRow {
  id: string
  signature: string
  display: string
  answer: number
  level: string
  category: CalcCategory
  last_wrong_at: string
  consecutive_correct: number
  resolved: boolean
  session_no: number | null
}

function rowToMistake(r: MistakeRow): CalcMistake {
  return {
    id: r.id,
    signature: r.signature,
    display: r.display,
    answer: r.answer,
    level: parseLevelKey(r.level),
    category: r.category,
    lastWrongAt: r.last_wrong_at,
    consecutiveCorrect: r.consecutive_correct,
    resolved: r.resolved,
    sessionNo: r.session_no ?? undefined,
  }
}

export function useCalcMistakes(user: User | null) {
  const [mistakes, setMistakes] = useState<CalcMistake[]>([])
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calc_mistakes')
        .select('id,signature,display,answer,level,category,last_wrong_at,consecutive_correct,resolved,session_no')
        .eq('user_id', user.id)
        .order('last_wrong_at', { ascending: false })
      if (cancelled) return
      setMistakes((data ?? []).map(r => rowToMistake(r as MistakeRow)))
      setIsLoading(false)
    }
    void init()
    return () => { cancelled = true }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('calc_mistakes')
      .select('id,signature,display,answer,level,category,last_wrong_at,consecutive_correct,resolved,session_no')
      .eq('user_id', user.id)
      .order('last_wrong_at', { ascending: false })
    setMistakes((data ?? []).map(r => rowToMistake(r as MistakeRow)))
  }, [user])

  /**
   * Add or re-set a mistake when the user answers wrong twice.
   * `sessionNo` is the running session's number; it is stored on both insert and
   * update so a repeatedly-missed mistake keeps moving forward to the latest
   * session and thus keeps being carried into the next one.
   */
  const addMistake = useCallback(
    async (q: CalcQuestion, sessionNo: number) => {
      if (!user) return
      try {
        await supabase
          .from('calc_mistakes')
          .upsert(
            {
              user_id: user.id,
              signature: q.signature,
              display: q.display,
              answer: q.answer,
              level: levelKey(q.level),
              category: q.category,
              last_wrong_at: new Date().toISOString(),
              consecutive_correct: 0,
              resolved: false,
              session_no: sessionNo,
            },
            { onConflict: 'user_id,signature' },
          )
      } catch { /* ignore */ }
      // Optimistic local update
      setMistakes(prev => {
        const existing = prev.find(m => m.signature === q.signature)
        if (existing) {
          return prev.map(m => m.signature === q.signature
            ? { ...m, consecutiveCorrect: 0, resolved: false, lastWrongAt: new Date().toISOString(), sessionNo }
            : m)
        }
        return [{
          signature: q.signature,
          display: q.display,
          answer: q.answer,
          level: q.level,
          category: q.category,
          lastWrongAt: new Date().toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          sessionNo,
        }, ...prev]
      })
    },
    [user],
  )

  /** Mark a correct answer against a mistake; advances consecutive_correct, sets resolved at 3. */
  const recordCorrect = useCallback(
    async (signature: string, sessionNo: number) => {
      if (!user) return
      const existing = mistakes.find(m => m.signature === signature)
      if (!existing) return
      const nextCount = existing.consecutiveCorrect + 1
      const nextResolved = nextCount >= 3
      try {
        await supabase
          .from('calc_mistakes')
          // Bump session_no to the current session so an unresolved mistake that made
          // partial progress (1–2 corrects) keeps carrying into the next session.
          .update({ consecutive_correct: nextCount, resolved: nextResolved, session_no: sessionNo })
          .eq('user_id', user.id)
          .eq('signature', signature)
      } catch { /* ignore */ }
      setMistakes(prev => prev.map(m => m.signature === signature
        ? { ...m, consecutiveCorrect: nextCount, resolved: nextResolved, sessionNo }
        : m))
    },
    [user, mistakes],
  )

  /** Unresolved mistakes recorded during the given (previous) session number. */
  const lastSessionUnresolved = useCallback(
    (prevSessionNo: number): CalcMistake[] =>
      mistakes.filter(m => !m.resolved && m.sessionNo === prevSessionNo),
    [mistakes],
  )

  return { mistakes, addMistake, recordCorrect, refresh, lastSessionUnresolved, isLoading }
}

export type { CalcLevel }
