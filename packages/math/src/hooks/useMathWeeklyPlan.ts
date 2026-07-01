'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { getWeekStart } from '@rosie/core'
import { todayStr } from '@rosie/core'
import type { MathWeeklyPlan, MathDayProgress } from '@rosie/core'
import { planEndDate } from '@rosie/math/utils/math-helpers'

const SYSTEM_DEFAULTS = { weekStartDay: 4, problemsPerDay: 3 }

type PlanMeta = Pick<MathWeeklyPlan, 'planEnd' | 'lessonIds' | 'sectionFilters' | 'tagFilters'>

type ProgressPayload = Record<string, MathDayProgress | PlanMeta | undefined> & {
  __planMeta?: PlanMeta
}

function stripPlanMeta(raw: ProgressPayload): { progress: MathWeeklyPlan['progress']; meta?: PlanMeta } {
  const entries = Object.entries(raw ?? {}).filter(([k]) => k !== '__planMeta')
  const progress = Object.fromEntries(entries) as MathWeeklyPlan['progress']
  return { progress, meta: raw?.__planMeta }
}

function withPlanMeta(plan: MathWeeklyPlan): ProgressPayload {
  return {
    ...plan.progress,
    __planMeta: {
      planEnd: plan.planEnd,
      lessonIds: plan.lessonIds,
      sectionFilters: plan.sectionFilters,
      tagFilters: plan.tagFilters,
    },
  }
}

async function loadAllPlansFromCloud(userId: string): Promise<MathWeeklyPlan[]> {
  try {
    const { data } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start, week_start_day, problems_per_day, plan_data, progress_data')
      .eq('user_id', userId)
    if (!data) return []
    return data.map(row => {
      const days = row.plan_data as MathWeeklyPlan['days']
      const { progress, meta } = stripPlanMeta((row.progress_data as ProgressPayload) ?? {})
      return {
        weekStart: row.week_start,
        planEnd: meta?.planEnd,
        lessonId: row.lesson_id,
        lessonIds: meta?.lessonIds,
        sectionFilters: meta?.sectionFilters,
        tagFilters: meta?.tagFilters,
        weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
        problemsPerDay: row.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
        days,
        progress,
      }
    })
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
          progress_data: withPlanMeta(plan),
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

  // Active plan = whichever plan's date range covers today.
  const weeklyPlan = useMemo(() => {
    const t = todayStr()
    return plansState.find(plan => plan.weekStart <= t && t <= planEndDate(plan)) ?? null
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
