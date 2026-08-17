'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, todayStr } from '@rosie/core'
import {
  ADAPTIVE_PROGRESS_CHANGED_EVENT,
  type AdaptiveDailyProgress,
} from '../utils/adaptivePlanPracticeLog'
import {
  applyAdaptiveDailyProgress,
  summarizeAdaptiveTodayProgress,
} from '../utils/adaptivePlanScheduler'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../utils/adaptivePlanTypes'
import { useAdaptiveWordPlan } from './useAdaptiveWordPlan'

export type AdaptiveTodayProgressSummary = ReturnType<typeof summarizeAdaptiveTodayProgress>

/**
 * Active adaptive plan + today's mandatory progress for homepage /today cards.
 * Progress rows are fetched on demand (not session-cached): the card is small
 * and must reflect mid-day settles without inventing a second global store.
 */
export function useAdaptiveTodayProgress(user: User | null): {
  activePlan: AdaptiveWordPlan | null
  summary: AdaptiveTodayProgressSummary | null
  isLoading: boolean
} {
  const { plans, isLoading: plansLoading, loadProgress } = useAdaptiveWordPlan(user)
  const activePlan = useMemo(() => plans.find((plan) => plan.status === 'active') ?? null, [plans])

  const [rows, setRows] = useState<AdaptivePlanWordProgress[] | null>(null)
  const [daily, setDaily] = useState<AdaptiveDailyProgress | null>(null)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const today = todayStr()

  const reload = useCallback(() => {
    setReloadToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', reload)
    window.addEventListener(ADAPTIVE_PROGRESS_CHANGED_EVENT, reload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', reload)
      window.removeEventListener(ADAPTIVE_PROGRESS_CHANGED_EVENT, reload)
    }
  }, [reload])

  useEffect(() => {
    if (!activePlan) {
      setRows(null)
      setDaily(null)
      setRowsLoading(false)
      return
    }

    let cancelled = false
    setRowsLoading(true)

    void Promise.all([
      loadProgress(activePlan.id),
      supabase
        .from('adaptive_daily_progress')
        .select(
          'plan_id,practice_date,new_goal,review_goal,new_done,review_done,all_done,completed_at',
        )
        .eq('user_id', activePlan.userId)
        .eq('plan_id', activePlan.id)
        .eq('practice_date', today)
        .maybeSingle(),
    ])
      .then(([loaded, dailyResult]) => {
        if (cancelled) return
        setRows(loaded)
        const row = dailyResult.data
        setDaily(
          row
            ? {
                planId: row.plan_id as string,
                practiceDate: row.practice_date as string,
                newGoal: row.new_goal as number,
                reviewGoal: row.review_goal as number,
                newDone: row.new_done as number,
                reviewDone: row.review_done as number,
                allDone: row.all_done as boolean,
                completedAt: row.completed_at as string | null,
              }
            : null,
        )
        setRowsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setDaily(null)
        setRowsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePlan, loadProgress, reloadToken, today])

  const summary = useMemo(() => {
    if (!activePlan || rows == null) return null
    return applyAdaptiveDailyProgress(
      summarizeAdaptiveTodayProgress(activePlan, rows, today),
      daily,
    )
  }, [activePlan, daily, rows, today])

  return {
    activePlan,
    summary,
    isLoading: plansLoading || (!!activePlan && (rowsLoading || rows == null)),
  }
}
