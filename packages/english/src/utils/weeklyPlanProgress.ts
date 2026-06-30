import type {
  WeekDayProgress,
  WeekCompletion,
  EnglishWeeklyReport,
  WeeklyPlanSessionStash,
} from '@rosie/core'

/** Embedded in `weekly_plans.progress_data` JSON; never a valid YYYY-MM-DD date. */
export const WEEKLY_PLAN_STORAGE_META_KEY = '__rosie_wk' as const
export const WEEKLY_PLAN_SESSION_META_KEY = '__rosie_session' as const

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

export function isValidSessionStash(x: unknown): x is WeeklyPlanSessionStash {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false
  const o = x as Partial<WeeklyPlanSessionStash>
  return (
    o.version === 3 &&
    typeof o.savedAt === 'string' &&
    (o.phase === 'study' || o.phase === 'quiz') &&
    typeof o.selectedDate === 'string' &&
    typeof o.subTask === 'string' &&
    typeof o.studyIdx === 'number' &&
    Array.isArray(o.words) &&
    Array.isArray(o.quizQs) &&
    typeof o.curQ === 'number' &&
    Array.isArray(o.quizResults)
  )
}

export function weeklySessionStorageKey(planId: string): string {
  return `weekly_session_${planId}`
}

export function loadLocalSessionSnapshot(planId: string | undefined): WeeklyPlanSessionStash | null {
  if (!planId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(weeklySessionStorageKey(planId))
    if (!raw) return null
    const snap = JSON.parse(raw) as unknown
    return isValidSessionStash(snap) ? snap : null
  } catch {
    return null
  }
}

export function pickBestPendingSnapshot(
  planId: string | undefined,
  cloud?: WeeklyPlanSessionStash | null,
): WeeklyPlanSessionStash | null {
  const local = loadLocalSessionSnapshot(planId)
  const cloudValid = cloud && isValidSessionStash(cloud) ? cloud : null
  if (!local && !cloudValid) return null
  if (!local) return cloudValid
  if (!cloudValid) return local
  return cloudValid.savedAt > local.savedAt ? cloudValid : local
}

export function decodeWeeklyPlanProgress(
  raw: unknown,
): {
  progress: Record<string, WeekDayProgress>
  weekCompletion: WeekCompletion | undefined
  pendingSession: WeeklyPlanSessionStash | undefined
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { progress: {}, weekCompletion: undefined, pendingSession: undefined }
  }
  const o = raw as Record<string, unknown>
  const metaRaw = o[WEEKLY_PLAN_STORAGE_META_KEY]
  const sessionRaw = o[WEEKLY_PLAN_SESSION_META_KEY]
  const {
    [WEEKLY_PLAN_STORAGE_META_KEY]: _m,
    [WEEKLY_PLAN_SESSION_META_KEY]: _s,
    ...rest
  } = o
  const pendingSession = isValidSessionStash(sessionRaw) ? sessionRaw : undefined
  if (isStoredMetaV1(metaRaw)) {
    return {
      progress: rest as Record<string, WeekDayProgress>,
      weekCompletion: { completedAt: metaRaw.completedAt, report: metaRaw.report },
      pendingSession,
    }
  }
  return {
    progress: rest as Record<string, WeekDayProgress>,
    weekCompletion: undefined,
    pendingSession,
  }
}

export function encodeWeeklyPlanProgress(
  progress: Record<string, WeekDayProgress>,
  weekCompletion: WeekCompletion | undefined,
  pendingSession?: WeeklyPlanSessionStash | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...progress }
  if (weekCompletion) {
    out[WEEKLY_PLAN_STORAGE_META_KEY] = { v: 1, ...weekCompletion } satisfies StoredMetaV1
  }
  if (pendingSession && isValidSessionStash(pendingSession)) {
    out[WEEKLY_PLAN_SESSION_META_KEY] = pendingSession
  }
  return out
}
