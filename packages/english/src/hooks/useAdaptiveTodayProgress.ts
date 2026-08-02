'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { todayStr } from '@rosie/core'
import { summarizeAdaptiveTodayProgress } from '../utils/adaptivePlanScheduler'
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
  const activePlan = useMemo(
    () => plans.find((plan) => plan.status === 'active') ?? null,
    [plans],
  )

  const [rows, setRows] = useState<AdaptivePlanWordProgress[] | null>(null)
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
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', reload)
    }
  }, [reload])

  useEffect(() => {
    if (!activePlan) {
      setRows(null)
      setRowsLoading(false)
      return
    }

    let cancelled = false
    setRowsLoading(true)

    void loadProgress(activePlan.id)
      .then((loaded) => {
        if (cancelled) return
        setRows(loaded)
        setRowsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setRowsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePlan, loadProgress, reloadToken])

  const summary = useMemo(() => {
    if (!activePlan || rows == null) return null
    return summarizeAdaptiveTodayProgress(activePlan, rows, today)
  }, [activePlan, rows, today])

  return {
    activePlan,
    summary,
    isLoading: plansLoading || (!!activePlan && (rowsLoading || rows == null)),
  }
}
