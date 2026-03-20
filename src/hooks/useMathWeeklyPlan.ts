'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { getWeekStart } from '@/utils/english-helpers'
import type { MathWeeklyPlan, MathDayProgress } from '@/utils/type'

function loadWeekStartDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.MATH_WEEK_START_DAY)
    return v !== null ? Number(v) : 4
  } catch { return 4 }
}

function loadProblemsPerDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.MATH_WEEKLY_PROBLEMS_PER_DAY)
    return v !== null ? Number(v) : 3
  } catch { return 3 }
}

function loadLocal(): MathWeeklyPlan | null {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.MATH_WEEKLY_PLAN)
    if (!item) return null
    return JSON.parse(item) as MathWeeklyPlan
  } catch {
    return null
  }
}

function saveLocal(plan: MathWeeklyPlan) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.MATH_WEEKLY_PLAN, JSON.stringify(plan))
  } catch { /* ignore */ }
}

async function loadFromCloud(userId: string, weekStart: string): Promise<MathWeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('math_weekly_plans')
      .select('lesson_id, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      lessonId: data.lesson_id,
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
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

// Load all prior plans (all weeks except current) to get prior problem keys for Ebbinghaus review
async function loadAllPriorPlans(userId: string | null, currentWeekStart: string): Promise<MathWeeklyPlan[]> {
  try {
    if (userId) {
      const { data } = await supabase
        .from('math_weekly_plans')
        .select('lesson_id, plan_data, progress_data, week_start')
        .eq('user_id', userId)
        .neq('week_start', currentWeekStart)
      if (data) {
        return data.map(row => ({
          weekStart: row.week_start,
          lessonId: row.lesson_id,
          days: row.plan_data as MathWeeklyPlan['days'],
          progress: (row.progress_data as MathWeeklyPlan['progress']) ?? {},
        }))
      }
    }
  } catch { /* ignore */ }
  return []
}

export function useMathWeeklyPlan(user: User | null) {
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [problemsPerDay, setProblemsPerDayState] = useState<number>(3)
  const currentWeekStart = useMemo(() => getWeekStart(undefined, weekStartDay), [weekStartDay])
  const [weeklyPlan, setWeeklyPlan] = useState<MathWeeklyPlan | null>(null)
  const [priorPlans, setPriorPlans] = useState<MathWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from localStorage on mount
  useEffect(() => {
    setWeekStartDay(loadWeekStartDay())
    setProblemsPerDayState(loadProblemsPerDay())
  }, [])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const stored = loadLocal()
      if (stored && stored.weekStart === currentWeekStart) {
        setWeeklyPlan(stored)
      } else {
        setWeeklyPlan(null)
      }

      if (user) {
        const cloud = await loadFromCloud(user.id, currentWeekStart)
        if (cloud) {
          setWeeklyPlan(cloud)
          saveLocal(cloud)
        }
        const prior = await loadAllPriorPlans(user.id, currentWeekStart)
        setPriorPlans(prior)
      }

      setIsLoading(false)
    }
    void init()
  }, [user, currentWeekStart])

  const savePlan = useCallback(async (plan: MathWeeklyPlan) => {
    setWeeklyPlan(plan)
    saveLocal(plan)
    if (user) await saveToCloud(user.id, plan)
  }, [user])

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
      saveLocal(updated)
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
      saveLocal(updated)
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  // Collect all prior problem keys for Ebbinghaus review scheduling
  const allPriorKeys: string[] = useMemo(() => priorPlans.flatMap(plan =>
    plan.days.flatMap(day => [...day.problems, ...day.optionalProblems].map(p => p.key))
  ), [priorPlans])

  // Map from key → MathPlanProblem for all prior problems (for rendering review items)
  const priorProblemMap = useMemo(() => Object.fromEntries(
    priorPlans.flatMap(plan =>
      plan.days.flatMap(day =>
        [...day.problems, ...day.optionalProblems].map(p => [p.key, p])
      )
    )
  ), [priorPlans])

  const saveWeekStartDay = useCallback((day: number) => {
    setWeekStartDay(day)
    try { window.localStorage.setItem(STORAGE_KEYS.MATH_WEEK_START_DAY, String(day)) } catch { /* ignore */ }
  }, [])

  const saveProblemsPerDay = useCallback((n: number) => {
    setProblemsPerDayState(n)
    try { window.localStorage.setItem(STORAGE_KEYS.MATH_WEEKLY_PROBLEMS_PER_DAY, String(n)) } catch { /* ignore */ }
  }, [])

  return {
    weeklyPlan, priorPlans, allPriorKeys, priorProblemMap,
    currentWeekStart, weekStartDay, problemsPerDay,
    savePlan, addDoneKey, updateDayProgress,
    saveWeekStartDay, saveProblemsPerDay,
    isLoading,
  }
}
