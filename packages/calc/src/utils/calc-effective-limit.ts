import { blockById } from './calc-blocks'
import { TIME_TARGETS } from './calc-time-targets'
import type { CalcQuestion } from '@rosie/core'

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
 * - When timed mode is on and explicitSeconds > 0 → use explicit
 * - Else → TIME_TARGETS[sourceId].fluent[1], else groupDefault
 */
export function effectiveLimitSec(input: EffectiveLimitInput): number {
  const { timedAnswerEnabled, explicitSeconds, sourceId } = input
  if (timedAnswerEnabled && explicitSeconds != null && explicitSeconds > 0) {
    return explicitSeconds
  }
  if (sourceId) {
    const target = TIME_TARGETS[sourceId]
    if (target) return target.fluent[1]
    const block = blockById(sourceId)
    if (block) {
      const byBlock = TIME_TARGETS[block.id]
      if (byBlock) return byBlock.fluent[1]
    }
  }
  return groupDefaultLimitSec(sourceId)
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
