import type { CalcSettings } from '@rosie/core'

const DEFAULT_QUESTION_COUNT = 20

/**
 * The number of questions a daily session will generate from the persisted
 * settings. Keep every UI target/progress display aligned with this function.
 */
export function calcPlannedQuestionCount(settings: CalcSettings): number {
  if (settings.countMode === 'auto') {
    return settings.lastCount > 0 ? settings.lastCount : DEFAULT_QUESTION_COUNT
  }

  const manualTotal =
    settings.selectedBlocks.reduce((sum, block) => sum + block.count, 0) +
    settings.mixedOps
      .filter((operation) => operation.enabled)
      .reduce((sum, operation) => sum + operation.count, 0)

  // buildSession also guarantees that an empty manual configuration still
  // produces a usable session.
  return manualTotal > 0
    ? manualTotal
    : settings.lastCount > 0
      ? settings.lastCount
      : DEFAULT_QUESTION_COUNT
}
