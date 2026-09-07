import type { CalcSettings } from '@rosie/core'
import { blockById } from './calc-blocks'
import { isMixedOpValid } from './calc-mixed'

const DEFAULT_QUESTION_COUNT = 20
export const MAX_SESSION_QUESTION_COUNT = 200

export function clampSessionQuestionCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_QUESTION_COUNT
  return Math.min(MAX_SESSION_QUESTION_COUNT, Math.max(1, Math.floor(count)))
}

/**
 * The number of questions a daily session will generate from the persisted
 * settings. Keep every UI target/progress display aligned with this function.
 */
export function calcPlannedQuestionCount(settings: CalcSettings): number {
  const requested =
    settings.lastCount > 0 ? clampSessionQuestionCount(settings.lastCount) : DEFAULT_QUESTION_COUNT
  if (settings.countMode === 'auto') return requested

  // Manual percentages guarantee at least one question for every enabled
  // source, so a configuration with more sources than requested questions
  // necessarily grows to that minimum.
  const sourceCount =
    settings.selectedBlocks.length +
    settings.mixedOps.filter((operation) => operation.enabled).length
  return Math.max(requested, sourceCount || 1)
}

/** Actual base-session estimate after enforcing one question per configured source. */
export function calcExpandedQuestionCount(settings: CalcSettings, targetCount: number): number {
  const sourceCount =
    settings.selectedBlocks.filter((block) => blockById(block.id) != null).length +
    settings.mixedOps.filter((operation) => operation.enabled && isMixedOpValid(operation)).length
  return Math.max(clampSessionQuestionCount(targetCount), sourceCount || 1)
}
