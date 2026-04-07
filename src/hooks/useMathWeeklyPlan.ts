'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getWeekStart } from '@/utils/english-helpers'
import type { MathWeeklyPlan, MathDayProgress } from '@/utils/type'

const SYSTEM_DEFAULTS = { weekStartDay: 4, problemsPerDay: 3 }

async function loadFromCloud(userId: string, weekStart: string): Promise<MathWeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start_day, problems_per_day, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      lessonId: data.lesson_id,
      weekStartDay: data.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
      problemsPerDay: data.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
      days: data.plan_data as MathWeeklyPlan['days'],
      progress: (data.progress_data as MathWeeklyPlan['progress']) ?? {},
    }
  } catch {
    return null
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

async function loadAllPriorPlans(userId: string, currentWeekStart: string): Promise<MathWeeklyPlan[]> {
  try {
    const { data } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, week_start_day, problems_per_day, plan_data, progress_data, week_start')
      .eq('user_id', userId)
      .neq('week_start', currentWeekStart)
    if (data) {
      return data.map(row => ({
        weekStart: row.week_start,
        lessonId: row.lesson_id,
        weekStartDay: row.week_start_day ?? SYSTEM_DEFAULTS.weekStartDay,
        problemsPerDay: row.problems_per_day ?? SYSTEM_DEFAULTS.problemsPerDay,
        days: row.plan_data as MathWeeklyPlan['days'],
        progress: (row.progress_data as MathWeeklyPlan['progress']) ?? {},
      }))
    }
  } catch { /* ignore */ }
  return []
}

export function useMathWeeklyPlan(user: User | null) {
  const [weeklyPlan, setWeeklyPlan] = useState<MathWeeklyPlan | null>(null)
  const [priorPlans, setPriorPlans] = useState<MathWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // defaultParams derived from most recent prior plan (sorted by weekStart desc)
  const defaultParams = useMemo((): { weekStartDay: number; problemsPerDay: number } => {
    if (priorPlans.length === 0) return SYSTEM_DEFAULTS
    const sorted = [...priorPlans].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    const recent = sorted[0]
    return {
      weekStartDay: recent.weekStartDay,
      problemsPerDay: recent.problemsPerDay,
    }
  }, [priorPlans])

  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, 4)
  }, [])

  useEffect(() => {
    if (!user) return
    const init = async () => {
      setIsLoading(true)
      const [cloud, prior] = await Promise.all([
        loadFromCloud(user.id, currentWeekStart),
        loadAllPriorPlans(user.id, currentWeekStart),
      ])
      setWeeklyPlan(cloud)
      setPriorPlans(prior)
      setIsLoading(false)
    }
    void init()
  }, [user, currentWeekStart])

  const savePlan = useCallback(async (plan: MathWeeklyPlan) => {
    if (plan.weekStart === currentWeekStart) {
      setWeeklyPlan(plan)
    } else {
      setPriorPlans(prev => {
        const idx = prev.findIndex(p => p.weekStart === plan.weekStart)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = plan
          return copy
        }
        return [...prev, plan]
      })
    }
    if (user) await saveToCloud(user.id, plan)
  }, [user, currentWeekStart])

  const addDoneKey = useCallback(async (date: string, key: string) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const existing = prev.progress[date] ?? { doneKeys: [] }
      if (existing.doneKeys.includes(key)) return prev
      const today = new Date().toISOString()
      const dayPlan = prev.days.find(d => d.date === date)
      const newDoneKeys = [...existing.doneKeys, key]
      const allRequired = dayPlan?.problems.map(p => p.key) ?? []
      const allDone = allRequired.every(k => newDoneKeys.includes(k))
      const updated: MathWeeklyPlan = {
        ...prev,
        progress: {
          ...prev.progress,
          [date]: {
            doneKeys: newDoneKeys,
            completedAt: allDone ? (existing.completedAt ?? today) : existing.completedAt,
          },
        },
      }
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  const updateDayProgress = useCallback(async (date: string, progress: MathDayProgress) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const updated: MathWeeklyPlan = {
        ...prev,
        progress: { ...prev.progress, [date]: progress },
      }
      if (user) void saveToCloud(user.id, updated)
      return updated
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
    if (weekStart === currentWeekStart) {
      setWeeklyPlan(null)
    } else {
      setPriorPlans(prev => prev.filter(p => p.weekStart !== weekStart))
    }
  }, [user, currentWeekStart])

  const allPlans = useMemo(() => {
    const plans: MathWeeklyPlan[] = [...priorPlans]
    if (weeklyPlan) plans.push(weeklyPlan)
    return plans.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  }, [priorPlans, weeklyPlan])

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
