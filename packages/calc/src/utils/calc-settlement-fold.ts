import type { CalcProblemState, QuestionLogEntry } from '@rosie/core'
import { applyAttempt, defaultProblemState } from './calc-apply-attempt'
import { MASTERY_STREAK_K } from './calc-effective-limit'
import { recordRemediationCorrect, recordRemediationWrong } from './calc-remediation'

/** Fold the immutable answer log once; only the touched signatures are submitted. */
export function foldCalcSettlement(
  log: QuestionLogEntry[],
  previous: Map<string, CalcProblemState>,
  sessionNo: number,
  today: string,
  recordMistakes: boolean,
): CalcProblemState[] {
  const changed = new Map<string, CalcProblemState>()

  for (const entry of log) {
    if (!entry.signature || entry.level === undefined || entry.finallyOk === undefined) {
      throw new Error('incomplete calc settlement log')
    }
    const prior =
      changed.get(entry.signature) ??
      previous.get(entry.signature) ??
      defaultProblemState(entry.signature, entry.level)
    const withinLimit = entry.ok && entry.finallyOk && entry.withinLimit === true
    let state = applyAttempt(
      prior,
      {
        correct: entry.finallyOk,
        timeMs: entry.finalMs ?? entry.ms,
        withinLimit,
        evidenceKind: entry.evidenceKind,
      },
      withinLimit,
      sessionNo,
      today,
      entry.presentationKey,
    )

    if (!entry.finallyOk && recordMistakes) {
      state = recordRemediationWrong(state, {
        at: state.updatedAt,
        sessionNo,
        userAnswer: entry.finalAnswer,
        answer: entry.answerJson,
        errorTag: entry.errorTag,
      })
    } else if (entry.finallyOk && state.needsRemediation) {
      state = recordRemediationCorrect(state)
      if (!state.needsRemediation) {
        state = {
          ...state,
          status: 'mastered',
          proficiency: Math.max(state.proficiency, 4),
          consecutiveCorrect: Math.max(state.consecutiveCorrect, MASTERY_STREAK_K),
        }
      }
    }

    if (entry.sourceBlockId) state.blockId = entry.sourceBlockId
    if (entry.sourceMixedOpId) state.mixedOpId = entry.sourceMixedOpId
    changed.set(entry.signature, state)
  }

  return [...changed.values()]
}
