import { supabase } from '@/lib/supabase'
import type { WeeklyPlan } from '@/utils/type'
import { decodeWeeklyPlanProgress } from '@/utils/weeklyPlanProgress'
import { parsePlanDataFromSupabase } from '@/utils/weeklyPlanPayload'

export async function loadWeeklyPlanById(
  userId: string,
  planId: string,
): Promise<WeeklyPlan | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('id, week_start, unit, lesson, week_start_day, new_words_per_day, plan_data, progress_data')
      .eq('user_id', userId)
      .eq('id', planId)
      .single()
    if (error || !data) return null
    const row = data as Record<string, unknown>
    const { progress, weekCompletion } = decodeWeeklyPlanProgress(row.progress_data)
    const { days, previewLessonKeys, wordKinds } = parsePlanDataFromSupabase(row.plan_data)
    return {
      id: row.id as string,
      weekStart: row.week_start as string,
      unit: row.unit as string,
      lesson: row.lesson as string,
      weekStartDay: (row.week_start_day as number) ?? 4,
      newWordsPerDay: (row.new_words_per_day as number) ?? 3,
      days,
      ...(previewLessonKeys !== undefined ? { previewLessonKeys } : {}),
      ...(wordKinds !== undefined ? { wordKinds } : {}),
      progress,
      weekCompletion,
    }
  } catch {
    return null
  }
}
