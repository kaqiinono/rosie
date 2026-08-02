/**
 * Math practice queue pending via @rosie/core practicePending.
 */
import { todayStr } from '@rosie/core'
import {
  clearLocalPending,
  clearPendingEverywhere,
  readLocalPending,
  resolvePending,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '@rosie/core'
import type { PracticeQueuePhase } from './practice-queue-types'

export const MATH_PRACTICE_SNAPSHOT_VERSION = 1
export const MATH_PENDING_KIND = 'math' as const
/** Single active math practice queue per user (plan / sea / etc. share one slot). */
export const MATH_PENDING_SCOPE = 'active-queue'

export type MathPracticeQueueItemRef = {
  problemId: string
  lessonId: string
  section: string
  detailHref: string
}

export type MathPracticeSnapshot = {
  version: number
  date: string
  items: MathPracticeQueueItemRef[]
  currentIndex: number
  sessionCorrect: number
  phase: PracticeQueuePhase
  returnHref: string
  title: string
  immersive: boolean
}

function isValidSnap(snap: unknown): snap is MathPracticeSnapshot {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as MathPracticeSnapshot
  return (
    s.version === MATH_PRACTICE_SNAPSHOT_VERSION &&
    Array.isArray(s.items) &&
    s.items.length > 0 &&
    typeof s.currentIndex === 'number' &&
    s.currentIndex >= 0 &&
    s.currentIndex < s.items.length &&
    s.phase === 'answering'
  )
}

export function wrapMathEnvelope(
  snap: MathPracticeSnapshot,
): PracticePendingEnvelope<MathPracticeSnapshot> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...snap, date: todayStr() },
  }
}

export function writeMathPracticeSnapshot(snap: MathPracticeSnapshot): void {
  writeLocalPending(MATH_PENDING_KIND, MATH_PENDING_SCOPE, wrapMathEnvelope(snap))
}

export function clearMathPracticeSnapshot(): void {
  clearLocalPending(MATH_PENDING_KIND, MATH_PENDING_SCOPE)
}

export async function clearMathPendingEverywhere(
  userId: string | null | undefined,
): Promise<void> {
  await clearPendingEverywhere(userId, MATH_PENDING_KIND, MATH_PENDING_SCOPE)
}

export function readMathPracticeSnapshot(today = todayStr()): MathPracticeSnapshot | null {
  const env = readLocalPending<MathPracticeSnapshot>(MATH_PENDING_KIND, MATH_PENDING_SCOPE, today)
  if (!env || !isValidSnap(env.stash)) {
    if (env) clearMathPracticeSnapshot()
    return null
  }
  return env.stash
}

export async function resolveMathPracticeSnapshot(
  userId: string | null | undefined,
): Promise<MathPracticeSnapshot | null> {
  const env = await resolvePending<MathPracticeSnapshot>(
    userId,
    MATH_PENDING_KIND,
    MATH_PENDING_SCOPE,
  )
  if (!env || !isValidSnap(env.stash)) return null
  writeLocalPending(MATH_PENDING_KIND, MATH_PENDING_SCOPE, env)
  return env.stash
}
