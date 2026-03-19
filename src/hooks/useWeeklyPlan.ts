'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { getWeekStart } from '@/utils/english-helpers'
import type { WeeklyPlan, WeekDayProgress } from '@/utils/type'

function loadLocal(): WeeklyPlan | null {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.WEEKLY_PLAN)
    if (!item) return null
    return JSON.parse(item) as WeeklyPlan
  } catch {
    return null
  }
}

function saveLocal(plan: WeeklyPlan) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.WEEKLY_PLAN, JSON.stringify(plan))
  } catch { /* ignore */ }
}

async function loadFromCloud(userId: string, weekStart: string): Promise<WeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('unit, lesson, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single()
    if (error || !data) return null
    return {
      weekStart,
      unit: data.unit,
      lesson: data.lesson,
      days: data.plan_data as WeeklyPlan['days'],
      progress: (data.progress_data as WeeklyPlan['progress']) ?? {},
    }
  } catch {
    return null
  }
}

async function saveToCloud(userId: string, plan: WeeklyPlan): Promise<void> {
  try {
    await supabase
      .from('weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          unit: plan.unit,
          lesson: plan.lesson,
          plan_data: plan.days,
          progress_data: plan.progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
  } catch { /* ignore */ }
}

function loadWeekStartDay(): number {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.WEEK_START_DAY)
    return v !== null ? Number(v) : 4
  } catch {
    return 4
  }
}

export function useWeeklyPlan(user: User | null) {
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const currentWeekStart = useMemo(() => getWeekStart(undefined, weekStartDay), [weekStartDay])
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [previousPlan, setPreviousPlan] = useState<WeeklyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load weekStartDay from localStorage on mount
  useEffect(() => {
    setWeekStartDay(loadWeekStartDay())
  }, [])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const stored = loadLocal()
      if (stored && stored.weekStart === currentWeekStart) {
        setWeeklyPlan(stored)
      } else {
        setWeeklyPlan(null)
        setPreviousPlan(stored ?? null)
      }

      if (user) {
        const cloud = await loadFromCloud(user.id, currentWeekStart)
        if (cloud) {
          setWeeklyPlan(cloud)
          saveLocal(cloud)
        }
      }

      setIsLoading(false)
    }
    void init()
  }, [user, currentWeekStart])

  const saveWeekStartDay = useCallback((day: number) => {
    setWeekStartDay(day)
    try { window.localStorage.setItem(STORAGE_KEYS.WEEK_START_DAY, String(day)) } catch { /* ignore */ }
  }, [])

  const savePlan = useCallback(async (plan: WeeklyPlan) => {
    setWeeklyPlan(plan)
    saveLocal(plan)
    if (user) await saveToCloud(user.id, plan)
  }, [user])

  const updateDayProgress = useCallback(async (date: string, progress: WeekDayProgress) => {
    setWeeklyPlan(prev => {
      if (!prev) return prev
      const updated: WeeklyPlan = {
        ...prev,
        progress: { ...prev.progress, [date]: progress },
      }
      saveLocal(updated)
      if (user) void saveToCloud(user.id, updated)
      return updated
    })
  }, [user])

  return { weeklyPlan, previousPlan, currentWeekStart, weekStartDay, saveWeekStartDay, savePlan, updateDayProgress, isLoading }
}
