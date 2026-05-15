'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getWeekStart } from '@/utils/english-helpers'
import { todayStr } from '@/utils/constant'
import type { MathWeeklyPlan, MathDayProgress } from '@/utils/type'

const SYSTEM_DEFAULTS = { weekStartDay: 4, problemsPerDay: 3 }

function weekEndDateOf(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

async function loadAllPlansFromCloud(userId: string): Promise<MathWeeklyPlan[]> {
  try {
    const { data } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start, week_start_day, problems_per_day, plan_data, progress_data')
      .eq('user_id', userId)
    if (!data) return []
    return data.map(row => ({
      weekStart: row.week_start,
      lessonId: row.lesson_id,
      weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
      problemsPerDay: row.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
      days: row.plan_data as MathWeeklyPlan['days'],
      progress: (row.progress_data as MathWeeklyPlan['progress']) ?? {},
    }))
  } catch {
    return []
  }
}

async function saveToCloud(userId: string, plan: MathWeeklyPlan): Promise<void> {
  try {
    await supabase
      .from('math_weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          lesson_id: plan.lessonId,
          week_start_day: plan.weekStartDay,
          problems_per_day: plan.problemsPerDay,
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

export function useMathWeeklyPlan(user: User | null) {
  const [plansState, setPlansState] = useState<MathWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const init = async () => {
      setIsLoading(true)
      const plans = await loadAllPlansFromCloud(user.id)
      setPlansState(plans)
      setIsLoading(false)
    }
    void init()
  }, [user])

  // The "current week plan" is whichever plan's 7-day range covers today,
  // regardless of weekStartDay — this avoids mismatches when users change start day.
  const weeklyPlan = useMemo(() => {
    const t = todayStr()
    return plansState.find(plan => plan.weekStart <= t && t <= weekEndDateOf(plan.weekStart)) ?? null
  }, [plansState])

  const priorPlans = useMemo(
    () => plansState.filter(p => p !== weeklyPlan),
    [plansState, weeklyPlan],
  )

  // defaultParams derived from most recent plan (sorted by weekStart desc)
  const defaultParams = useMemo((): { weekStartDay: number; problemsPerDay: number } => {
    if (plansState.length === 0) return SYSTEM_DEFAULTS
    const sorted = [...plansState].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    const recent = sorted[0]
    return {
      weekStartDay: recent.weekStartDay,
      problemsPerDay: recent.problemsPerDay,
    }
  }, [plansState])

  // currentWeekStart follows the user's preferred weekStartDay so "this week"
  // matches the user's calendar convention.
  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams.weekStartDay])

  const savePlan = useCallback(async (plan: MathWeeklyPlan) => {
    setPlansState(prev => {
      const idx = prev.findIndex(p => p.weekStart === plan.weekStart)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = plan
        return copy
      }
      return [...prev, plan]
    })
    if (user) await saveToCloud(user.id, plan)
  }, [user])

  const addDoneKey = useCallback(async (date: string, key: string) => {
    setPlansState(prev => {
      const idx = prev.findIndex(plan => plan.days.some(d => d.date === date))
      if (idx < 0) return prev
      const plan = prev[idx]
      const existing = plan.progress[date] ?? { doneKeys: [] }
      if (existing.doneKeys.includes(key)) return prev
      const now = new Date().toISOString()
      const dayPlan = plan.days.find(d => d.date === date)
      const newDoneKeys = [...existing.doneKeys, key]
      const allRequired = dayPlan?.problems.map(p => p.key) ?? []
      const allDone = allRequired.every(k => newDoneKeys.includes(k))
      const updated: MathWeeklyPlan = {
        ...plan,
        progress: {
          ...plan.progress,
          [date]: {
            doneKeys: newDoneKeys,
            completedAt: allDone ? (existing.completedAt ?? now) : existing.completedAt,
          },
        },
      }
      if (user) void saveToCloud(user.id, updated)
      const copy = [...prev]
      copy[idx] = updated
      return copy
    })
  }, [user])

  const updateDayProgress = useCallback(async (date: string, progress: MathDayProgress) => {
    setPlansState(prev => {
      const idx = prev.findIndex(plan => plan.days.some(d => d.date === date))
      if (idx < 0) return prev
      const plan = prev[idx]
      const updated: MathWeeklyPlan = {
        ...plan,
        progress: { ...plan.progress, [date]: progress },
      }
      if (user) void saveToCloud(user.id, updated)
      const copy = [...prev]
      copy[idx] = updated
      return copy
    })
  }, [user])

  const deletePlan = useCallback(async (weekStart: string) => {
    if (!user) return
    try {
      await supabase
        .from('math_weekly_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
    } catch { /* ignore */ }
    setPlansState(prev => prev.filter(p => p.weekStart !== weekStart))
  }, [user])

  const allPlans = useMemo(
    () => [...plansState].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [plansState],
  )

  const allPriorKeys: string[] = useMemo(() => priorPlans.flatMap(plan =>
    plan.days.flatMap(day => [...day.problems, ...day.optionalProblems].map(p => p.key))
  ), [priorPlans])

  const priorProblemMap = useMemo(() => Object.fromEntries(
    priorPlans.flatMap(plan =>
      plan.days.flatMap(day =>
        [...day.problems, ...day.optionalProblems].map(p => [p.key, p])
      )
    )
  ), [priorPlans])

  return {
    weeklyPlan, priorPlans, allPlans, allPriorKeys, priorProblemMap,
    currentWeekStart, defaultParams,
    savePlan, addDoneKey, updateDayProgress, deletePlan,
    isLoading,
  }
}
