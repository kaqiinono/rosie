import type { CalcProblemState, QuestionAttempt } from '@rosie/core'

/** Legacy attempts predate evidenceKind and represent the original independent path. */
export function isIndependentEvidence(attempt: QuestionAttempt): boolean {
  return attempt.evidenceKind === undefined || attempt.evidenceKind === 'independent'
}

export function isWithinTargetEvidence(attempt: QuestionAttempt): boolean {
  return isIndependentEvidence(attempt) && attempt.correct && attempt.withinLimit === true
}

/** Recall verifies retention; make-up never upgrades durable mastery. */
export function isMasteryEvidence(attempt: QuestionAttempt): boolean {
  return attempt.evidenceKind !== 'makeup'
}

/**
 * Old rows can have appearanceCount without retained recentResults. Treat that as
 * grandfathered independent exposure; new rows must contain independent evidence.
 */
export function hasIndependentAttempt(state: CalcProblemState | undefined): boolean {
  if (!state || state.appearanceCount <= 0) return false
  if (state.recentResults.length === 0) return true
  return state.recentResults.some(isIndependentEvidence)
}

export function hasWithinTargetAttempt(state: CalcProblemState | undefined): boolean {
  return state?.recentResults.some(isWithinTargetEvidence) ?? false
}
