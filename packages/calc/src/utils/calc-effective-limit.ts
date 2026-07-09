import type { CalcQuestion } from '@rosie/core'
import { resolveTargetSec } from './calc-session-policy'

/** Consecutive within-limit corrects required to enter mastered. */
export const MASTERY_STREAK_K = 3

/** Fallback when TIME_TARGETS has no entry for the source. */
export function groupDefaultLimitSec(sourceId: string | undefined): number {
  if (!sourceId) return 6
  if (sourceId.startsWith('mul') || sourceId.startsWith('div') || sourceId.startsWith('md')) return 5
  if (sourceId.startsWith('frac') || sourceId.startsWith('dec')) return 12
  if (sourceId.startsWith('as')) return 10
  return 6
}

export type EffectiveLimitInput = {
  timedAnswerEnabled: boolean
  /** Per-source explicit seconds from settings (null/0 = unset). */
  explicitSeconds: number | null | undefined
  /** block id or mixed skeleton / op id used to look up TIME_TARGETS. */
  sourceId: string | undefined
}

/**
 * Cognitive speed threshold (seconds). Decoupled from UI countdown:
 * explicit > 0 else TIME_TARGETS.fluent[1] else group default (see resolveTargetSec).
 */
export function effectiveLimitSec(input: EffectiveLimitInput): number {
  return resolveTargetSec({
    explicitSeconds: input.explicitSeconds,
    sourceId: input.sourceId,
  })
}

/** Resolve source id for limit lookup from a question. */
export function sourceIdForLimit(q: CalcQuestion): string | undefined {
  return q.sourceBlockId ?? q.sourceMixedOpId
}

export function isWithinEffectiveLimit(
  elapsedMs: number,
  input: EffectiveLimitInput,
): boolean {
  return elapsedMs <= effectiveLimitSec(input) * 1000
}
