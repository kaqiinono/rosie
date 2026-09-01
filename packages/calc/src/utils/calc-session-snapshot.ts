/**
 * Calc mid-session pending via @rosie/core practicePending (localStorage + cloud).
 */
import type {
  CalcLevel,
  CalcMode,
  CalcPresentationKey,
  CalcQuestion,
  CalcTimingMode,
  QuestionLogEntry,
} from '@rosie/core'
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

export const CALC_SESSION_SNAPSHOT_VERSION = 1
export const CALC_PENDING_KIND = 'calc' as const

export type CalcAttemptStatSnapshot = {
  signature: string
  level: CalcLevel
  isChallenge: boolean
  firstTryCorrect: boolean
  finallyCorrect: boolean
  wasMistake: boolean
  timeMs: number
  withinLimit: boolean
  evidenceKind?: 'independent' | 'makeup' | 'recall'
  sourceBlockId?: string
  sourceMixedOpId?: string
  display?: string
  presentationKey?: CalcPresentationKey
}

export type CalcSessionSnapshot = {
  version: number
  date: string
  mode: CalcMode
  /** Stable key for drill / mistakes sessions; null for normal daily. */
  drillKey: string | null
  questions: CalcQuestion[]
  idx: number
  wrongQueue: CalcQuestion[]
  plannedCount: number
  maxRetry: number
  coinsTotal: number
  streak: number
  maxStreak: number
  attemptsLog: CalcAttemptStatSnapshot[]
  questionTimesMs: number[]
  questionLog: QuestionLogEntry[]
  startedAtIso: string
  startedTsMs: number
  /**
   * Active practice time accumulated before the current run. `startedTsMs` restarts
   * on resume, so the hours a stashed session spends idle are not billed as practice.
   */
  carriedElapsedMs?: number
  timingMode: CalcTimingMode
  bonusSec: number
  drillTargetSignatures: string[]
  /** Stable across local/cloud resume and future settlement retries. */
  idempotencyKey?: string
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function ensureCalcSettlementIdentity(snap: CalcSessionSnapshot): CalcSessionSnapshot {
  return snap.idempotencyKey ? snap : { ...snap, idempotencyKey: newIdempotencyKey() }
}

function drillKeyFromParams(
  drill: string | null,
  blockId: string | null,
  mode: CalcMode,
): string | null {
  if (mode === 'mistakes') return 'mistakes'
  if (!drill) return null
  if (drill === 'weak-formulas') return 'weak-formulas'
  if (drill === 'breakthrough' && blockId) return `breakthrough:${blockId}`
  return drill
}

export function calcSessionDrillKey(
  mode: CalcMode,
  drill: string | null,
  blockId: string | null,
): string | null {
  return drillKeyFromParams(drill, blockId, mode)
}

export function calcPendingScopeKey(mode: CalcMode, drillKey: string | null): string {
  return drillKey ? `${mode}:${drillKey}` : mode
}

function isValidCalcSnap(snap: unknown): snap is CalcSessionSnapshot {
  if (!snap || typeof snap !== 'object') return false
  const s = snap as CalcSessionSnapshot
  return (
    s.version === CALC_SESSION_SNAPSHOT_VERSION &&
    Array.isArray(s.questions) &&
    s.questions.length > 0 &&
    typeof s.idx === 'number' &&
    s.idx >= 0 &&
    s.idx < s.questions.length &&
    // Zero-progress snapshots are not resumable; ignore any already written by
    // an older build so they can't keep hijacking the prep screen.
    (s.idx > 0 || (Array.isArray(s.attemptsLog) && s.attemptsLog.length > 0))
  )
}

export function wrapCalcEnvelope(
  snap: CalcSessionSnapshot,
): PracticePendingEnvelope<CalcSessionSnapshot> {
  const identified = ensureCalcSettlementIdentity(snap)
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    date: todayStr(),
    stash: { ...identified, date: todayStr() },
  }
}

export function writeCalcSessionSnapshot(snap: CalcSessionSnapshot): void {
  const scope = calcPendingScopeKey(snap.mode, snap.drillKey)
  writeLocalPending(CALC_PENDING_KIND, scope, wrapCalcEnvelope(snap))
}

export function clearCalcSessionSnapshot(mode: CalcMode, drillKey: string | null): void {
  clearLocalPending(CALC_PENDING_KIND, calcPendingScopeKey(mode, drillKey))
}

export async function clearCalcPendingEverywhere(
  userId: string | null | undefined,
  mode: CalcMode,
  drillKey: string | null,
): Promise<void> {
  await clearPendingEverywhere(userId, CALC_PENDING_KIND, calcPendingScopeKey(mode, drillKey))
}

/** Local-only read (sync). Prefer resolveCalcSessionSnapshot when user is known. */
export function readCalcSessionSnapshot(
  mode: CalcMode,
  drillKey: string | null,
  today = todayStr(),
): CalcSessionSnapshot | null {
  const env = readLocalPending<CalcSessionSnapshot>(
    CALC_PENDING_KIND,
    calcPendingScopeKey(mode, drillKey),
    today,
  )
  if (!env || !isValidCalcSnap(env.stash)) {
    if (env) clearCalcSessionSnapshot(mode, drillKey)
    return null
  }
  if (env.stash.mode !== mode || (env.stash.drillKey ?? null) !== (drillKey ?? null)) {
    clearCalcSessionSnapshot(mode, drillKey)
    return null
  }
  const identified = ensureCalcSettlementIdentity(env.stash)
  if (identified !== env.stash) writeCalcSessionSnapshot(identified)
  return identified
}

export async function resolveCalcSessionSnapshot(
  userId: string | null | undefined,
  mode: CalcMode,
  drillKey: string | null,
): Promise<CalcSessionSnapshot | null> {
  const env = await resolvePending<CalcSessionSnapshot>(
    userId,
    CALC_PENDING_KIND,
    calcPendingScopeKey(mode, drillKey),
  )
  if (!env || !isValidCalcSnap(env.stash)) return null
  if (env.stash.mode !== mode || (env.stash.drillKey ?? null) !== (drillKey ?? null)) return null
  // Mirror winning snapshot to local for fast next open.
  const identified = ensureCalcSettlementIdentity(env.stash)
  const identifiedEnv = { ...env, stash: identified }
  mirrorResolvedPending(CALC_PENDING_KIND, calcPendingScopeKey(mode, drillKey), identifiedEnv)
  return identified
}
