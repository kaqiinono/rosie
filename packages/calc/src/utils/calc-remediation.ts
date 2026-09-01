import type { CalcAnswer, CalcProblemState, ErrorTag } from '@rosie/core'
import { MASTERY_STREAK_K } from './calc-effective-limit'

export interface RemediationWrongEvidence {
  at: string
  sessionNo: number
  userAnswer?: string
  answer?: CalcAnswer
  errorTag?: ErrorTag | null
}

/** Pure transition for the current remediation projection. */
export function recordRemediationWrong(
  state: CalcProblemState,
  evidence: RemediationWrongEvidence,
): CalcProblemState {
  return {
    ...state,
    needsRemediation: true,
    lastWrongAt: evidence.at,
    lastWrongSessionNo: evidence.sessionNo,
    lastErrorTag: evidence.errorTag ?? null,
    lastUserAnswer: evidence.userAnswer ?? null,
    lastAnswerJson: evidence.answer ?? null,
    remediationCorrectCount: 0,
  }
}

/** Pure transition for one deliberate make-up answer. */
export function recordRemediationCorrect(state: CalcProblemState): CalcProblemState {
  if (!state.needsRemediation) return state
  const nextCount = Math.min(MASTERY_STREAK_K, (state.remediationCorrectCount ?? 0) + 1)
  return {
    ...state,
    needsRemediation: nextCount < MASTERY_STREAK_K,
    remediationCorrectCount: nextCount,
  }
}
