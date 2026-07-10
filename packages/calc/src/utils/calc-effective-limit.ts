import type { CalcQuestion } from '@rosie/core'
import { resolveTargetSec } from './calc-session-policy'

/** Consecutive within-limit corrects required to enter mastered. */
export const MASTERY_STREAK_K = 3

export type EffectiveLimitInput = {
  timedAnswerEnabled: boolean
  /** Per-source explicit seconds from settings (null/0 = unset). */
  explicitSeconds: number | null | undefined
  /** block id or mixed skeleton / op id used to look up TIME_TARGETS. */
  sourceId: string | undefined
}

/**
 * Cognitive speed threshold (seconds). Decoupled from UI countdown:
 * (timedAnswerEnabled ? explicit > 0 : ignore) else TIME_TARGETS.fluent[1]
 * else group default (see resolveTargetSec). When the countdown toggle is
 * off, a stale explicit setting must not stretch the cognitive threshold.
 */
export function effectiveLimitSec(input: EffectiveLimitInput): number {
  return resolveTargetSec({
    explicitSeconds: input.timedAnswerEnabled ? input.explicitSeconds : null,
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
