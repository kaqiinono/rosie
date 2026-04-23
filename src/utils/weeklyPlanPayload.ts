import type { WeeklyPlan, WeeklyPlanDay } from '@/utils/type'

/**
 * Supabase `plan_data` is either a legacy JSON array of `WeeklyPlanDay`,
 * or `{ days, previewLessonKeys?, wordKinds? }`.
 */
export function parsePlanDataFromSupabase(raw: unknown): {
  days: WeeklyPlan['days']
  previewLessonKeys?: string[]
  wordKinds?: Record<string, 'consolidate' | 'preview'>
} {
  if (Array.isArray(raw)) {
    return { days: raw as WeeklyPlan['days'] }
  }
  if (raw && typeof raw === 'object' && 'days' in raw) {
    const o = raw as {
      days: unknown
      previewLessonKeys?: unknown
      wordKinds?: unknown
    }
    if (Array.isArray(o.days)) {
      const wordKindsRaw = o.wordKinds
      let wordKinds: Record<string, 'consolidate' | 'preview'> | undefined
      if (wordKindsRaw && typeof wordKindsRaw === 'object' && !Array.isArray(wordKindsRaw)) {
        wordKinds = {}
        for (const [key, val] of Object.entries(wordKindsRaw as Record<string, unknown>)) {
          if (val === 'consolidate' || val === 'preview') wordKinds[key] = val
        }
        if (Object.keys(wordKinds).length === 0) wordKinds = undefined
      }
      return {
        days: o.days as WeeklyPlan['days'],
        previewLessonKeys: Array.isArray(o.previewLessonKeys)
          ? (o.previewLessonKeys as string[])
          : undefined,
        wordKinds,
      }
    }
  }
  return { days: [] }
}

export type PlanDataRow =
  | WeeklyPlanDay[]
  | {
      days: WeeklyPlanDay[]
      previewLessonKeys?: string[]
      wordKinds?: Record<string, 'consolidate' | 'preview'>
    }

export function serializePlanDataForSupabase(plan: WeeklyPlan): PlanDataRow {
  if (plan.previewLessonKeys !== undefined || plan.wordKinds !== undefined) {
    return {
      days: plan.days,
      ...(plan.previewLessonKeys !== undefined ? { previewLessonKeys: plan.previewLessonKeys } : {}),
      ...(plan.wordKinds !== undefined ? { wordKinds: plan.wordKinds } : {}),
    }
  }
  return plan.days
}
