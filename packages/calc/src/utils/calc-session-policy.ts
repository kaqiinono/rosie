import type { CalcTimingMode } from '@rosie/core'
import { TIME_TARGETS } from './calc-time-targets'

export type { CalcTimingMode }

/** Fallback when TIME_TARGETS has no entry for the source. */
export function groupDefaultLimitSec(sourceId: string | undefined): number {
  if (!sourceId) return 6
  if (sourceId.startsWith('mul') || sourceId.startsWith('div') || sourceId.startsWith('md')) return 5
  if (sourceId.startsWith('frac') || sourceId.startsWith('dec')) return 12
  if (sourceId.startsWith('as')) return 10
  return 6
}

export function maxRetryCeiling(plannedCount: number): number {
  return Math.max(3, Math.floor(Math.max(0, plannedCount) * 0.15))
}

export function clampBonusSec(n: number): number {
  return Math.min(15, Math.max(0, Math.floor(n)))
}

export function resolveTargetSec(args: {
  explicitSeconds: number | null | undefined
  sourceId: string | undefined
}): number {
  const { explicitSeconds, sourceId } = args
  if (explicitSeconds != null && explicitSeconds > 0) return explicitSeconds
  if (sourceId && TIME_TARGETS[sourceId]) return TIME_TARGETS[sourceId].fluent[1]
  return groupDefaultLimitSec(sourceId)
}

export function resolveClockSec(args: {
  mode: CalcTimingMode
  targetSec: number
  bonusSec: number
  timedAnswerEnabled: boolean
  explicitSeconds: number | null | undefined
}): number | null {
  const { mode, targetSec, bonusSec, timedAnswerEnabled, explicitSeconds } = args
  if (mode === 'strict') return targetSec
  if (mode === 'bonus') return targetSec + clampBonusSec(bonusSec)
  // relaxed
  if (timedAnswerEnabled && explicitSeconds != null && explicitSeconds > 0) return explicitSeconds
  return null
}

export function tryEnqueueRetry<T>(pool: T[], item: T, maxRetry: number): { pool: T[]; enqueued: boolean } {
  if (pool.length >= maxRetry) return { pool, enqueued: false }
  return { pool: [...pool, item], enqueued: true }
}

export function isInMakeupPhase(idx: number, plannedCount: number): boolean {
  return idx >= plannedCount
}

export function sessionStarMultiplier(mode: CalcTimingMode, bonusSec: number): number {
  if (mode === 'relaxed') return 1
  if (mode === 'strict') return 1.2
  return Math.max(1, 1.2 - 0.05 * clampBonusSec(bonusSec))
}

export function applySessionStarMultiplier(
  rawStars: number,
  mode: CalcTimingMode,
  bonusSec: number,
): number {
  return Math.round(rawStars * sessionStarMultiplier(mode, bonusSec))
}
