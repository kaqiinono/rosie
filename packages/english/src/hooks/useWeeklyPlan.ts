'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import { getWeekStart } from '../utils/english-helpers'
import { decodeWeeklyPlanProgress, encodeWeeklyPlanProgress } from '../utils/weeklyPlanProgress'
import { parsePlanDataFromSupabase, serializePlanDataForSupabase } from '../utils/weeklyPlanPayload'
import type { WeeklyPlan, WeekDayProgress } from '@rosie/core'

const SYSTEM_DEFAULTS = { weekStartDay: 4, newWordsPerDay: 3 }

async function loadAllPlansFromCloud(userId: string): Promise<WeeklyPlan[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select(
        'id, week_start, unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data',
      )
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
    if (error || !data) return []
    return data.map((row) => {
      const { progress, weekCompletion, pendingSession } = decodeWeeklyPlanProgress(
        row.progress_data,
      )
      const { days, previewLessonKeys, wordKinds, focusLessonKey, batchMode } = parsePlanDataFromSupabase(
        row.plan_data,
      )
      return {
        id: row.id as string,
        weekStart: row.week_start,
        unit: row.unit,
        lesson: row.lesson,
        weekStartDay:
          ((row as Record<string, unknown>).week_start_day as number) ??
          SYSTEM_DEFAULTS.weekStartDay,
        newWordsPerDay:
          ((row as Record<string, unknown>).new_words_per_day as number) ??
          SYSTEM_DEFAULTS.newWordsPerDay,
        days,
        ...(previewLessonKeys !== undefined ? { previewLessonKeys } : {}),
        ...(wordKinds !== undefined ? { wordKinds } : {}),
        ...(focusLessonKey !== undefined ? { focusLessonKey } : {}),
        ...(batchMode !== undefined ? { batchMode } : {}),
        progress,
        weekCompletion,
        ...(pendingSession !== undefined ? { pendingSession } : {}),
      }
    })
  } catch {
    return []
  }
}

async function saveToCloud(userId: string, plan: WeeklyPlan): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .upsert(
        {
          user_id: userId,
          week_start: plan.weekStart,
          unit: plan.unit,
          lesson: plan.lesson,
          week_start_day: plan.weekStartDay,
          new_words_per_day: plan.newWordsPerDay,
          plan_data: serializePlanDataForSupabase(plan),
          progress_data: encodeWeeklyPlanProgress(
            plan.progress,
            plan.weekCompletion,
            plan.pendingSession ?? null,
          ),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
      .select('id')
      .single()
    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export const englishWeeklyPlansStore = createUserSessionStore<WeeklyPlan[]>('weekly_plans', {
  fetch: loadAllPlansFromCloud,
  empty: [],
})

export function useWeeklyPlan(user: User | null) {
  const { data: allPlans, isLoading } = englishWeeklyPlansStore.useSessionData(user)
  const weeklyPlanRef = useRef<WeeklyPlan | null>(null)

  const defaultParams = useMemo(() => {
    if (allPlans.length === 0) return SYSTEM_DEFAULTS
    return {
      weekStartDay: allPlans[0].weekStartDay,
      newWordsPerDay: allPlans[0].newWordsPerDay,
    }
  }, [allPlans])

  const currentWeekStart = useMemo(() => {
    return getWeekStart(undefined, defaultParams.weekStartDay)
  }, [defaultParams.weekStartDay])

  const weeklyPlan = useMemo(() => {
    return allPlans.find((p) => p.weekStart === currentWeekStart) ?? null
  }, [allPlans, currentWeekStart])

  useEffect(() => {
    weeklyPlanRef.current = weeklyPlan
  }, [weeklyPlan])

  const selectPlan = useCallback((_plan: WeeklyPlan) => {
    /* kept for API compat — active plan is derived from currentWeekStart */
  }, [])

  const deletePlan = useCallback(
    async (weekStart: string) => {
      if (!user) return
      englishWeeklyPlansPatch(user.id, (prev) => prev.filter((p) => p.weekStart !== weekStart))
      try {
        await supabase
          .from('weekly_plans')
          .delete()
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
      } catch {
        /* ignore */
      }
    },
    [user],
  )

  const savePlan = useCallback(
    async (plan: WeeklyPlan): Promise<WeeklyPlan> => {
      if (!user) return plan
      englishWeeklyPlansPatch(user.id, (prev) => {
        const rest = prev.filter((p) => p.weekStart !== plan.weekStart)
        return [plan, ...rest]
      })
      const savedId = await saveToCloud(user.id, plan)
      if (savedId) {
        const withId = { ...plan, id: savedId }
        englishWeeklyPlansPatch(user.id, (prev) =>
          prev.map((p) => (p.weekStart === withId.weekStart ? withId : p)),
        )
        return withId
      }
      return plan
    },
    [user],
  )

  const updateDayProgress = useCallback(
    async (date: string, progress: WeekDayProgress) => {
      const current = weeklyPlanRef.current
      if (!current || !user) return
      const updated: WeeklyPlan = {
        ...current,
        progress: { ...current.progress, [date]: progress },
      }
      weeklyPlanRef.current = updated
      englishWeeklyPlansPatch(user.id, (prev) =>
        prev.map((p) => (p.weekStart === updated.weekStart ? updated : p)),
      )
      void saveToCloud(user.id, updated)
    },
    [user],
  )

  return {
    weeklyPlan,
    allPlans,
    selectPlan,
    deletePlan,
    previousPlan: null,
    currentWeekStart,
    defaultParams,
    savePlan,
    updateDayProgress,
    isLoading,
  }
}

function englishWeeklyPlansPatch(userId: string, patch: (prev: WeeklyPlan[]) => WeeklyPlan[]): void {
  englishWeeklyPlansStore.patchSessionData(userId, patch)
}
