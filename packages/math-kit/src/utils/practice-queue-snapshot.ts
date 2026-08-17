/**
 * Math practice queue pending via @rosie/core practicePending.
 *
 * Each practice *source* has its own scope (`queue:plan`, `queue:sea`, …) so
 * mid-exit stashes never overwrite or resume across entry points.
 * `returnHref` is only the exit navigation target — not a source tag.
 */
import { todayStr } from '@rosie/core'
import {
  clearLocalPending,
  clearPendingEverywhere,
  mirrorResolvedPending,
  readLocalPending,
  resolvePending,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '@rosie/core'
import type { PracticeQueuePhase } from './practice-queue-types'

export const MATH_PRACTICE_SNAPSHOT_VERSION = 3
export const MATH_PENDING_KIND = 'math' as const

/** @deprecated Pre-source single slot; migrated on first read into `queue:<source>`. */
export const MATH_PENDING_LEGACY_SCOPE = 'active-queue'

export type MathPracticeSource = 'plan' | 'sea' | 'lesson' | 'mistakes' | 'favorites'

export const MATH_PRACTICE_SOURCES: readonly MathPracticeSource[] = [
  'plan',
  'sea',
  'lesson',
  'mistakes',
  'favorites',
] as const

export function mathPendingScope(source: MathPracticeSource): string {
  return `queue:${source}`
}

/** Today-plan card / sync status: only plan (and legacy slot before migration). */
export function isMathTodayPlanScope(scopeKey: string): boolean {
  return scopeKey === mathPendingScope('plan') || scopeKey === MATH_PENDING_LEGACY_SCOPE
}

export type MathPracticeQueueItemRef = {
  problemId: string
  lessonId: string
  section: string
  detailHref: string
  planAssignment?: {
    planStart: string
    date: string
    assignmentId: string
  }
}

export type MathPracticeSnapshot = {
  version: typeof MATH_PRACTICE_SNAPSHOT_VERSION
  source: MathPracticeSource
  date: string
  items: MathPracticeQueueItemRef[]
  currentIndex: number
  sessionCorrect: number
  phase: PracticeQueuePhase
  returnHref: string
  title: string
  immersive: boolean
}

function isMathPracticeSource(v: unknown): v is MathPracticeSource {
  return typeof v === 'string' && (MATH_PRACTICE_SOURCES as readonly string[]).includes(v)
}

function inferSourceFromReturnHref(href: string): MathPracticeSource {
  if (href === '/math/ny/plan' || href.startsWith('/math/ny/plan/')) return 'plan'
  if (href === '/math/sea' || href.startsWith('/math/sea/')) return 'sea'
  if (href === '/math/mistakes' || href.startsWith('/math/mistakes/')) return 'mistakes'
  if (href === '/math/favorites' || href.startsWith('/math/favorites/')) return 'favorites'
  return 'lesson'
}

function isValidSnap(snap: unknown): snap is Omit<MathPracticeSnapshot, 'source'> & {
  source?: MathPracticeSource
} {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as MathPracticeSnapshot
  const verOk = s.version === MATH_PRACTICE_SNAPSHOT_VERSION
  return (
    verOk &&
    Array.isArray(s.items) &&
    s.items.length > 0 &&
    typeof s.currentIndex === 'number' &&
    s.currentIndex >= 0 &&
    s.currentIndex < s.items.length &&
    s.phase === 'answering' &&
    typeof s.returnHref === 'string'
  )
}

function normalizeSnap(
  snap: Omit<MathPracticeSnapshot, 'source'> & { source?: MathPracticeSource },
  fallbackSource: MathPracticeSource,
): MathPracticeSnapshot {
  const source = isMathPracticeSource(snap.source)
    ? snap.source
    : inferSourceFromReturnHref(snap.returnHref || '') || fallbackSource
  return {
    ...snap,
    version: MATH_PRACTICE_SNAPSHOT_VERSION,
    source,
    // Preserve stash date for same-day checks — only wrapMathEnvelope stamps today on write.
    date: typeof snap.date === 'string' && snap.date.length > 0 ? snap.date : todayStr(),
  }
}

function isSnapForToday(snap: MathPracticeSnapshot, today = todayStr()): boolean {
  return snap.date === today
}

/** Move `active-queue` into `queue:<inferred source>` then delete legacy (idempotent). */
export function migrateLegacyMathActiveQueue(): void {
  if (typeof window === 'undefined') return

  const env = readLocalPending<unknown>(MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
  if (!env) return
  if (!isValidSnap(env.stash)) {
    clearLocalPending(MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
    return
  }

  const snap = normalizeSnap(env.stash, 'lesson')
  const scope = mathPendingScope(snap.source)
  // Do not clobber a newer scoped stash.
  const existing = readLocalPending<unknown>(MATH_PENDING_KIND, scope, todayStr())
  if (!existing) {
    writeLocalPending(MATH_PENDING_KIND, scope, wrapMathEnvelope(snap))
  }
  clearLocalPending(MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
}

export function wrapMathEnvelope(
  snap: MathPracticeSnapshot,
): PracticePendingEnvelope<MathPracticeSnapshot> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...snap, date: todayStr(), version: MATH_PRACTICE_SNAPSHOT_VERSION },
  }
}

export function writeMathPracticeSnapshot(snap: MathPracticeSnapshot): void {
  migrateLegacyMathActiveQueue()
  const normalized = normalizeSnap(snap, snap.source)
  writeLocalPending(
    MATH_PENDING_KIND,
    mathPendingScope(normalized.source),
    wrapMathEnvelope(normalized),
  )
}

export function clearMathPracticeSnapshot(source: MathPracticeSource): void {
  migrateLegacyMathActiveQueue()
  clearLocalPending(MATH_PENDING_KIND, mathPendingScope(source))
}

export async function clearMathPendingEverywhere(
  userId: string | null | undefined,
  source: MathPracticeSource,
): Promise<void> {
  migrateLegacyMathActiveQueue()
  await clearPendingEverywhere(userId, MATH_PENDING_KIND, mathPendingScope(source))
  // Drop leftover legacy slot if still present (e.g. cloud-only).
  if (source === 'plan') {
    await clearPendingEverywhere(userId, MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
  }
}

export function readMathPracticeSnapshot(
  source: MathPracticeSource,
  today = todayStr(),
): MathPracticeSnapshot | null {
  migrateLegacyMathActiveQueue()
  const env = readLocalPending<unknown>(MATH_PENDING_KIND, mathPendingScope(source), today)
  if (!env || !isValidSnap(env.stash)) {
    if (env) clearMathPracticeSnapshot(source)
    return null
  }
  const snap = normalizeSnap(env.stash, source)
  if (snap.source !== source || !isSnapForToday(snap, today)) {
    clearMathPracticeSnapshot(source)
    return null
  }
  return snap
}

export async function resolveMathPracticeSnapshot(
  userId: string | null | undefined,
  source: MathPracticeSource,
): Promise<MathPracticeSnapshot | null> {
  migrateLegacyMathActiveQueue()
  const scope = mathPendingScope(source)
  const today = todayStr()
  const env = await resolvePending<unknown>(userId, MATH_PENDING_KIND, scope)
  if (!env || !isValidSnap(env.stash)) {
    // Legacy cloud row may still use active-queue — pull once for plan.
    if (source === 'plan') {
      const legacy = await resolvePending<unknown>(
        userId,
        MATH_PENDING_KIND,
        MATH_PENDING_LEGACY_SCOPE,
      )
      if (legacy && isValidSnap(legacy.stash)) {
        const snap = normalizeSnap(legacy.stash, 'plan')
        if (snap.source === 'plan' && isSnapForToday(snap, today)) {
          const mirrored: PracticePendingEnvelope<MathPracticeSnapshot> = {
            ...legacy,
            stash: snap,
          }
          mirrorResolvedPending(MATH_PENDING_KIND, scope, mirrored)
          void clearPendingEverywhere(userId, MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
          return snap
        }
        void clearPendingEverywhere(userId, MATH_PENDING_KIND, MATH_PENDING_LEGACY_SCOPE)
      }
    }
    return null
  }
  const snap = normalizeSnap(env.stash, source)
  if (snap.source !== source || !isSnapForToday(snap, today)) {
    void clearMathPendingEverywhere(userId, source)
    return null
  }
  const mirrored: PracticePendingEnvelope<MathPracticeSnapshot> = {
    ...(env as PracticePendingEnvelope<MathPracticeSnapshot>),
    stash: snap,
  }
  mirrorResolvedPending(MATH_PENDING_KIND, scope, mirrored)
  return snap
}

/** @deprecated Use mathPendingScope(source). Kept for tests touching legacy keys. */
export const MATH_PENDING_SCOPE = MATH_PENDING_LEGACY_SCOPE
