'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { getWeekStart } from '../utils/chinese-helpers'
import type { LessonCharGroup } from '../types/chineseCharData'
import {
  buildChineseWeeklyPlan,
  CHINESE_PLAN_DEFAULTS,
  parseChinesePlanFromRow,
  serializeChinesePlanForSupabase,
  type ChineseWeeklyPlan,
  type ChineseWeekDayProgress,
} from '../utils/chineseWeeklyPlan'

async function loadAllPlansFromCloud(
  userId: string,
  defaultLessonKey: string,
): Promise<ChineseWeeklyPlan[]> {
  try {
    const { data, error } = await supabase
      .from('chinese_weekly_plans')
      .select(
        'id, week_start, lesson_key, week_start_day, new_recognize_per_day, new_write_per_day, days, progress',
      )
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
    if (error || !data) return []
    return data.map((row) =>
      parseChinesePlanFromRow(row as Record<string, unknown>, defaultLessonKey),
    )
  } catch {
    return []
  }
}

async function saveToCloud(userId: string, plan: ChineseWeeklyPlan): Promise<string | null> {
  try {
    const payload = serializeChinesePlanForSupabase(plan)
    const { data, error } = await supabase
      .from('chinese_weekly_plans')
      .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id,week_start' })
      .select('id')
      .single()
    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export function useChineseWeeklyPlan(
  user: User | null,
  lessonGroups: LessonCharGroup[],
  bookSlug = 'g1b',
) {
  const defaultLessonKey = lessonGroups[0]?.lessonKey ?? 'u1-l1'

  const [defaultParams, setDefaultParams] = useState<{
    weekStartDay: number
    newRecognizePerDay: number
    newWritePerDay: number
  } | null>(null)
  const [weeklyPlan, setWeeklyPlan] = useState<ChineseWeeklyPlan | null>(null)
  const weeklyPlanRef = useRef<ChineseWeeklyPlan | null>(null)
  const [allPlans, setAllPlans] = useState<ChineseWeeklyPlan[]>([])
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    weeklyPlanRef.current = weeklyPlan
  }, [weeklyPlan])

  useEffect(() => {
    if (!user) return
    void (async () => {
      setIsLoading(true)
      const plans = await loadAllPlansFromCloud(user.id, defaultLessonKey)
      setAllPlans(plans)

      const params =
        plans.length > 0
          ? {
              weekStartDay: plans[0].weekStartDay,
              newRecognizePerDay: plans[0].newRecognizePerDay,
              newWritePerDay: plans[0].newWritePerDay,
            }
          : { ...CHINESE_PLAN_DEFAULTS }

      setDefaultParams(params)

      const weekStart = getWeekStart(undefined, params.weekStartDay)
      setWeeklyPlan(plans.find((p) => p.weekStart === weekStart) ?? null)
      setIsLoading(false)
    })()
  }, [user, defaultLessonKey])

  const currentWeekStart = useMemo(() => {
    if (!defaultParams) return null
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams])

  const savePlan = useCallback(
    async (plan: ChineseWeeklyPlan): Promise<ChineseWeeklyPlan> => {
      setWeeklyPlan(plan)
      setAllPlans((prev) => {
        const rest = prev.filter((p) => p.weekStart !== plan.weekStart)
        return [plan, ...rest]
      })
      if (user) {
        const savedId = await saveToCloud(user.id, plan)
        if (savedId) {
          const withId = { ...plan, id: savedId }
          weeklyPlanRef.current = withId
          setWeeklyPlan(withId)
          setAllPlans((prev) => prev.map((p) => (p.weekStart === withId.weekStart ? withId : p)))
          return withId
        }
      }
      return plan
    },
    [user],
  )

  const generatePlan = useCallback(
    async (lessonKey?: string): Promise<ChineseWeeklyPlan> => {
      const params = defaultParams ?? { ...CHINESE_PLAN_DEFAULTS }
      const key = lessonKey ?? defaultLessonKey
      const plan = buildChineseWeeklyPlan(
        lessonGroups,
        key,
        params.weekStartDay,
        params.newRecognizePerDay,
        params.newWritePerDay,
        currentWeekStart ?? undefined,
        bookSlug,
      )
      return savePlan(plan)
    },
    [currentWeekStart, defaultLessonKey, defaultParams, lessonGroups, savePlan, bookSlug],
  )

  const updateDayProgress = useCallback(
    async (date: string, progress: ChineseWeekDayProgress) => {
      const current = weeklyPlanRef.current
      if (!current) return
      const updated: ChineseWeeklyPlan = {
        ...current,
        progress: { ...current.progress, [date]: progress },
      }
      weeklyPlanRef.current = updated
      setWeeklyPlan(updated)
      setAllPlans((prev) => prev.map((p) => (p.weekStart === updated.weekStart ? updated : p)))
      if (user) void saveToCloud(user.id, updated)
    },
    [user],
  )

  return {
    weeklyPlan,
    allPlans,
    currentWeekStart,
    defaultParams,
    savePlan,
    generatePlan,
    updateDayProgress,
    isLoading,
  }
}
