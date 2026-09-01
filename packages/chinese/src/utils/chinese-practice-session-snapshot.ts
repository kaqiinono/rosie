/**
 * Chinese chars practice pending via @rosie/core practicePending.
 */
import type {
  PassageStep,
  PracticePhase,
  PracticeSessionPlan,
} from './chinese-chars-session-helpers'
import {
  clearLocalPending,
  clearPendingEverywhere,
  mirrorResolvedPending,
  readLocalPending,
  resolvePending,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '@rosie/core'
import { todayStr } from '@rosie/core'

/** v5: drop snaps that baked MCQ options with the pre-hashSeed overflow bug (always-D). */
export const CHINESE_PRACTICE_SNAPSHOT_VERSION = 5
export const CHINESE_PENDING_KIND = 'chinese' as const

export type LessonTypeStats = Record<string, { total: number; correct: number }>

export type ChinesePracticeSnapshot = {
  version: number
  date: string
  bookSlug: string
  scopeKey: string
  phase: PracticePhase
  cardIdx: number
  charQIdx: number
  phraseIdx: number
  poemIdx: number
  accIdx: number
  blankIdx: number
  passageLessonIdx: number
  passageStep: PassageStep
  passageBlankIdx: number
  pinyinWriteIdx: number
  earnedMoons: number
  correctCounts: { total: number; correct: number }
  plan: PracticeSessionPlan
  /** Roadmap plan id when launched with ?planId= */
  planId?: string | null
  /** Per-lesson per-phase answer tallies for plan settle */
  byLessonStats?: Record<string, LessonTypeStats>
  sessionStartedAt?: string
}

type ChinesePracticeScopeArgs = {
  bookSlug: string
  units: string
  lessons: string
  types: string
  cardPreview: string
  /** 仅练老师词语表（看拼写字）；隔离快照，避免与普通练习混用 */
  teacherOnly?: boolean
}

/** Pre-|p= format — used only to migrate same-day mid-session restores. */
export function chinesePracticeLegacyScopeKey(args: ChinesePracticeScopeArgs): string {
  return `${args.bookSlug}|u=${args.units}|l=${args.lessons}|t=${args.types}|c=${args.cardPreview}`
}

/**
 * Pending bucket key. `planId` isolates roadmap-plan runs from free practice
 * (`/chinese/.../chars` → practice) that may share the same lessons/types.
 */
export function chinesePracticeScopeKey(
  args: ChinesePracticeScopeArgs & { planId?: string | null },
): string {
  const planSeg = args.planId && args.planId.length > 0 ? args.planId : 'free'
  const teacherSeg = args.teacherOnly ? '|tw=1' : ''
  return `${chinesePracticeLegacyScopeKey(args)}|p=${planSeg}${teacherSeg}`
}

function isValidSnap(snap: unknown): snap is ChinesePracticeSnapshot {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as ChinesePracticeSnapshot
  return (
    s.version === CHINESE_PRACTICE_SNAPSHOT_VERSION &&
    !!s.plan &&
    Array.isArray(s.plan.charQuestions) &&
    s.phase !== 'done'
  )
}

export function wrapChineseEnvelope(
  snap: ChinesePracticeSnapshot,
): PracticePendingEnvelope<ChinesePracticeSnapshot> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...snap, date: todayStr() },
  }
}

export function writeChinesePracticeSnapshot(snap: ChinesePracticeSnapshot): void {
  writeLocalPending(CHINESE_PENDING_KIND, snap.scopeKey, wrapChineseEnvelope(snap))
}

export function clearChinesePracticeSnapshot(scopeKey: string): void {
  clearLocalPending(CHINESE_PENDING_KIND, scopeKey)
}

export async function clearChinesePendingEverywhere(
  userId: string | null | undefined,
  scopeKey: string,
): Promise<void> {
  await clearPendingEverywhere(userId, CHINESE_PENDING_KIND, scopeKey)
}

export function readChinesePracticeSnapshot(
  bookSlug: string,
  scopeKey: string,
  today = todayStr(),
): ChinesePracticeSnapshot | null {
  const env = readLocalPending<ChinesePracticeSnapshot>(CHINESE_PENDING_KIND, scopeKey, today)
  if (!env || !isValidSnap(env.stash) || env.stash.bookSlug !== bookSlug) {
    if (env) clearChinesePracticeSnapshot(scopeKey)
    return null
  }
  return env.stash
}

export async function resolveChinesePracticeSnapshot(
  userId: string | null | undefined,
  bookSlug: string,
  scopeKey: string,
  legacyScopeKey?: string,
  wantedPlanId?: string | null,
): Promise<ChinesePracticeSnapshot | null> {
  const env = await resolvePending<ChinesePracticeSnapshot>(userId, CHINESE_PENDING_KIND, scopeKey)
  if (env && isValidSnap(env.stash) && env.stash.bookSlug === bookSlug) {
    mirrorResolvedPending(CHINESE_PENDING_KIND, scopeKey, env)
    return env.stash
  }

  // Same-day migrate: pre-|p= keys shared free + plan; only claim matching planId.
  if (legacyScopeKey && legacyScopeKey !== scopeKey) {
    const legacyEnv = await resolvePending<ChinesePracticeSnapshot>(
      userId,
      CHINESE_PENDING_KIND,
      legacyScopeKey,
    )
    if (
      legacyEnv &&
      isValidSnap(legacyEnv.stash) &&
      legacyEnv.stash.bookSlug === bookSlug
    ) {
      const stashPlan = legacyEnv.stash.planId ?? null
      const wantPlan = wantedPlanId && wantedPlanId.length > 0 ? wantedPlanId : null
      if (stashPlan !== wantPlan) return null

      const migrated: ChinesePracticeSnapshot = {
        ...legacyEnv.stash,
        scopeKey,
        planId: wantPlan,
      }
      writeChinesePracticeSnapshot(migrated)
      await clearChinesePendingEverywhere(userId, legacyScopeKey)
      return migrated
    }
  }

  return null
}
