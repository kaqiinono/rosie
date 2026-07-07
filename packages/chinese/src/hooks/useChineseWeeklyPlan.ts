'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
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

/** Plans keyed by user; defaultLessonKey only affects parse fallback on fetch. */
const chineseWeeklyPlansStore = createUserSessionStore<ChineseWeeklyPlan[]>(
  'chinese_weekly_plans',
  {
    fetch: (userId) => loadAllPlansFromCloud(userId, 'u1-l1'),
    empty: [],
  },
)

export function useChineseWeeklyPlan(
  user: User | null,
  lessonGroups: LessonCharGroup[],
  bookSlug = 'g1b',
) {
  const defaultLessonKey = lessonGroups[0]?.lessonKey ?? 'u1-l1'
  const { data: allPlans, isLoading } = chineseWeeklyPlansStore.useSessionData(user)
  const weeklyPlanRef = useRef<ChineseWeeklyPlan | null>(null)

  const defaultParams = useMemo(() => {
    if (allPlans.length === 0) return { ...CHINESE_PLAN_DEFAULTS }
    return {
      weekStartDay: allPlans[0].weekStartDay,
      newRecognizePerDay: allPlans[0].newRecognizePerDay,
      newWritePerDay: allPlans[0].newWritePerDay,
    }
  }, [allPlans])

  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams.weekStartDay])

  const weeklyPlan = useMemo(
    () => allPlans.find((p) => p.weekStart === currentWeekStart) ?? null,
    [allPlans, currentWeekStart],
  )

  useEffect(() => {
    weeklyPlanRef.current = weeklyPlan
  }, [weeklyPlan])

  const savePlan = useCallback(
    async (plan: ChineseWeeklyPlan): Promise<ChineseWeeklyPlan> => {
      if (!user) return plan
      chineseWeeklyPlansStore.patchSessionData(user.id, (prev) => {
        const rest = prev.filter((p) => p.weekStart !== plan.weekStart)
        return [plan, ...rest]
      })
      const savedId = await saveToCloud(user.id, plan)
      if (savedId) {
        const withId = { ...plan, id: savedId }
        weeklyPlanRef.current = withId
        chineseWeeklyPlansStore.patchSessionData(user.id, (prev) =>
          prev.map((p) => (p.weekStart === withId.weekStart ? withId : p)),
        )
        return withId
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
      if (!current || !user) return
      const updated: ChineseWeeklyPlan = {
        ...current,
        progress: { ...current.progress, [date]: progress },
      }
      weeklyPlanRef.current = updated
      chineseWeeklyPlansStore.patchSessionData(user.id, (prev) =>
        prev.map((p) => (p.weekStart === updated.weekStart ? updated : p)),
      )
      void saveToCloud(user.id, updated)
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
