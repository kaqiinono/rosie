import type { CalcLevel, CalcPresentationKey, CalcProblemState, QuestionAttempt } from '@rosie/core'
import { nextMasteryTransition } from './calc-mastery'
import { CALC_FEATURES } from './calc-features'

const RECENT_CAP = 10

export function applyAttempt(
  prev: CalcProblemState,
  attempt: QuestionAttempt,
  withinLimit: boolean,
  sessionNo: number,
  today: string,
  /** 作答时的展示模式；记录到证据上，限时放宽已在上游 withinLimit 中体现。 */
  presentationKey?: CalcPresentationKey,
): CalcProblemState {
  const attemptWithLimit: QuestionAttempt = {
    ...attempt,
    withinLimit,
    sessionNo,
    date: today,
    ...(presentationKey ? { presentationKey } : {}),
  }
  const nextRecent = [...prev.recentResults, attemptWithLimit].slice(-RECENT_CAP)
  const nextAttemptCount = prev.attemptCount + 1

  const transition = CALC_FEATURES.masteryV2
    ? nextMasteryTransition(prev, nextRecent, attemptWithLimit)
    : {
        proficiency: attempt.correct
          ? Math.min(5, prev.proficiency + (withinLimit ? 1 : 0))
          : Math.max(0, prev.proficiency - 2),
        consecutiveCorrect: attempt.correct && withinLimit ? prev.consecutiveCorrect + 1 : 0,
        consecutiveWrong: attempt.correct ? 0 : prev.consecutiveWrong + 1,
        status:
          attempt.correct && withinLimit && prev.consecutiveCorrect >= 2
            ? ('mastered' as const)
            : ('active' as const),
      }

  return {
    ...prev,
    proficiency: transition.proficiency,
    attemptCount: nextAttemptCount,
    appearanceCount: prev.appearanceCount + 1,
    recentResults: nextRecent,
    status: transition.status,
    consecutiveWrong: transition.consecutiveWrong,
    consecutiveCorrect: transition.consecutiveCorrect,
    lastWithinLimit: withinLimit,
    updatedAt: new Date().toISOString(),
  }
}

export function defaultProblemState(signature: string, level: CalcLevel): CalcProblemState {
  return {
    signature,
    level,
    proficiency: 0,
    attemptCount: 0,
    appearanceCount: 0,
    recentResults: [],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
    lastWithinLimit: null,
    updatedAt: new Date().toISOString(),
  }
}
