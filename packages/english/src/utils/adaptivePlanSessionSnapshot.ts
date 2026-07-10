import type { QuizQuestion } from '@rosie/core'
import type { SessionOutcome } from './adaptivePlanSettle'

/**
 * sessionStorage snapshot of an in-progress adaptive-plan round, so an
 * accidental refresh / navigation (or a failed settle + reload) doesn't lose
 * the child's answers. Mirrors the WeeklyPlanSession restore pattern.
 *
 * Lifecycle: written on every question advance during active phases; cleared
 * when a round settles successfully (phase becomes `done` without a settle
 * failure) — kept on settle failure so a reload can re-settle.
 */
export const ADAPTIVE_SESSION_SNAPSHOT_VERSION = 1

export type AdaptiveSnapshotPhase = 'review' | 'study' | 'final' | 'boss' | 'boss_sink'

export type AdaptiveQuizSlotSnapshot = {
  key: string
  type: QuizQuestion['type']
}

export interface AdaptiveSessionSnapshot {
  version: number
  planId: string
  /** todayStr() at stash time — stale-day snapshots are discarded. */
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

export function adaptiveSessionStorageKey(planId: string): string {
  return `adaptive-plan-session:${planId}`
}

export function writeAdaptiveSessionSnapshot(snap: AdaptiveSessionSnapshot): void {
  try {
    sessionStorage.setItem(adaptiveSessionStorageKey(snap.planId), JSON.stringify(snap))
  } catch {
    /* storage unavailable — degrade to no restore */
  }
}

export function clearAdaptiveSessionSnapshot(planId: string): void {
  try {
    sessionStorage.removeItem(adaptiveSessionStorageKey(planId))
  } catch {
    /* noop */
  }
}

/** Read + validate; invalid/stale snapshots are removed and null is returned. */
export function readAdaptiveSessionSnapshot(
  planId: string,
  today: string,
): AdaptiveSessionSnapshot | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(adaptiveSessionStorageKey(planId))
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const snap = JSON.parse(raw) as AdaptiveSessionSnapshot
    if (
      snap.version !== ADAPTIVE_SESSION_SNAPSHOT_VERSION ||
      snap.planId !== planId ||
      snap.date !== today ||
      !PHASES.includes(snap.phase) ||
      !Array.isArray(snap.quizSlots) ||
      !Array.isArray(snap.reviewOutcomes)
    ) {
      clearAdaptiveSessionSnapshot(planId)
      return null
    }
    return snap
  } catch {
    clearAdaptiveSessionSnapshot(planId)
    return null
  }
}
