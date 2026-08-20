'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export type AdaptiveDailyHistoryRow = {
  practiceDate: string
  newGoal: number
  reviewGoal: number
  newDone: number
  reviewDone: number
  allDone: boolean
}

/**
 * Per-date adaptive plan completion rows (adaptive_daily_progress) for the
 * given plan. Used by the plan calendar / historical day view — the live
 * useAdaptiveTodayProgress hook only covers today. Pass planId = null to skip.
 */
export function useAdaptiveDailyHistory(user: User | null, planId: string | null) {
  const [rows, setRows] = useState<Map<string, AdaptiveDailyHistoryRow> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user || !planId) {
      setRows(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    void (async () => {
      try {
        const { data } = await supabase
          .from('adaptive_daily_progress')
          .select('practice_date,new_goal,review_goal,new_done,review_done,all_done')
          .eq('user_id', user.id)
          .eq('plan_id', planId)
        if (cancelled) return
        const map = new Map<string, AdaptiveDailyHistoryRow>()
        for (const r of data ?? []) {
          map.set(r.practice_date as string, {
            practiceDate: r.practice_date as string,
            newGoal: (r.new_goal as number) ?? 0,
            reviewGoal: (r.review_goal as number) ?? 0,
            newDone: (r.new_done as number) ?? 0,
            reviewDone: (r.review_done as number) ?? 0,
            allDone: (r.all_done as boolean) ?? false,
          })
        }
        setRows(map)
      } catch {
        if (cancelled) return
        setRows(new Map())
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, planId])

  return useMemo(() => ({ history: rows, isLoading }), [rows, isLoading])
}
