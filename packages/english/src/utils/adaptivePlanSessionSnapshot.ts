/**
 * Adaptive-plan mid-session pending via @rosie/core practicePending.
 */
import type { QuizQuestion } from '@rosie/core'
import {
  clearLocalPending,
  clearPendingEverywhere,
  readLocalPending,
  resolvePending,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '@rosie/core'
import { todayStr } from '@rosie/core'
import type { SessionOutcome } from './adaptivePlanSettle'

export const ADAPTIVE_SESSION_SNAPSHOT_VERSION = 1
export const ADAPTIVE_PENDING_KIND = 'english_adaptive' as const

export type AdaptiveSnapshotPhase = 'review' | 'study' | 'final' | 'boss' | 'boss_sink'

export type AdaptiveQuizSlotSnapshot = {
  key: string
  type: QuizQuestion['type']
}

export interface AdaptiveSessionSnapshot {
  version: number
  planId: string
  date: string
  phase: AdaptiveSnapshotPhase
  quizSlots: AdaptiveQuizSlotSnapshot[]
  curQ: number
  score: number
  reviewCursor: number
  reviewDoneKeys: string[]
  studyIdx: number
  activationApplied: boolean
  newStudyDone: number
  starsAwarded: number
  roundActivateKeys: string[]
  roundReviewKeys: string[]
  reviewOutcomes: SessionOutcome[]
  finalOutcomes: SessionOutcome[]
  bossFirstPassOutcomes: SessionOutcome[]
  bossSinkOutcomes: SessionOutcome[]
  finalPassWrongKeys: string[]
  bossPassWrongKeys: string[]
  bossSinkWrongKeys: string[]
}

const PHASES: readonly AdaptiveSnapshotPhase[] = [
  'review',
  'study',
  'final',
  'boss',
  'boss_sink',
]

function isValidSnap(snap: unknown): snap is AdaptiveSessionSnapshot {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as AdaptiveSessionSnapshot
  return (
    s.version === ADAPTIVE_SESSION_SNAPSHOT_VERSION &&
    typeof s.planId === 'string' &&
    PHASES.includes(s.phase) &&
    Array.isArray(s.quizSlots) &&
    Array.isArray(s.reviewOutcomes)
  )
}

export function adaptiveSessionStorageKey(planId: string): string {
  return planId
}

export function wrapAdaptiveEnvelope(
  snap: AdaptiveSessionSnapshot,
): PracticePendingEnvelope<AdaptiveSessionSnapshot> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...snap, date: todayStr() },
  }
}

export function writeAdaptiveSessionSnapshot(snap: AdaptiveSessionSnapshot): void {
  writeLocalPending(ADAPTIVE_PENDING_KIND, snap.planId, wrapAdaptiveEnvelope(snap))
}

export function clearAdaptiveSessionSnapshot(planId: string): void {
  clearLocalPending(ADAPTIVE_PENDING_KIND, planId)
}

export async function clearAdaptivePendingEverywhere(
  userId: string | null | undefined,
  planId: string,
): Promise<void> {
  await clearPendingEverywhere(userId, ADAPTIVE_PENDING_KIND, planId)
}

export function readAdaptiveSessionSnapshot(
  planId: string,
  today: string,
): AdaptiveSessionSnapshot | null {
  const env = readLocalPending<AdaptiveSessionSnapshot>(ADAPTIVE_PENDING_KIND, planId, today)
  if (!env || !isValidSnap(env.stash) || env.stash.planId !== planId || env.stash.date !== today) {
    if (env) clearAdaptiveSessionSnapshot(planId)
    return null
  }
  return env.stash
}

export async function resolveAdaptiveSessionSnapshot(
  userId: string | null | undefined,
  planId: string,
  today = todayStr(),
): Promise<AdaptiveSessionSnapshot | null> {
  const env = await resolvePending<AdaptiveSessionSnapshot>(userId, ADAPTIVE_PENDING_KIND, planId)
  if (!env || !isValidSnap(env.stash) || env.stash.planId !== planId || env.stash.date !== today) {
    return null
  }
  writeLocalPending(ADAPTIVE_PENDING_KIND, planId, env)
  return env.stash
}
