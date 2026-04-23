import type { WeekDayProgress, WeekCompletion, EnglishWeeklyReport } from '@/utils/type'

/** Embedded in `weekly_plans.progress_data` JSON; never a valid YYYY-MM-DD date. */
export const WEEKLY_PLAN_STORAGE_META_KEY = '__rosie_wk' as const

type StoredMetaV1 = { v: 1; completedAt: string; report: EnglishWeeklyReport }

function isStoredMetaV1(x: unknown): x is StoredMetaV1 {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.completedAt === 'string' &&
    o.report !== null &&
    typeof o.report === 'object' &&
    !Array.isArray(o.report)
  )
}

export function decodeWeeklyPlanProgress(
  raw: unknown,
): { progress: Record<string, WeekDayProgress>; weekCompletion: WeekCompletion | undefined } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { progress: {}, weekCompletion: undefined }
  }
  const o = raw as Record<string, unknown>
  const metaRaw = o[WEEKLY_PLAN_STORAGE_META_KEY]
  const { [WEEKLY_PLAN_STORAGE_META_KEY]: _m, ...rest } = o
  if (isStoredMetaV1(metaRaw)) {
    return {
      progress: rest as Record<string, WeekDayProgress>,
      weekCompletion: { completedAt: metaRaw.completedAt, report: metaRaw.report },
    }
  }
  return { progress: rest as Record<string, WeekDayProgress>, weekCompletion: undefined }
}

export function encodeWeeklyPlanProgress(
  progress: Record<string, WeekDayProgress>,
  weekCompletion: WeekCompletion | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...progress }
  if (weekCompletion) {
    out[WEEKLY_PLAN_STORAGE_META_KEY] = { v: 1, ...weekCompletion } satisfies StoredMetaV1
  }
  return out
}
