import type {
  CalcLevel,
  CalcProblemState,
  CalcProblemStatus,
  QuestionAttempt,
} from '@rosie/core'
import { MASTERY_STREAK_K } from './calc-effective-limit'

const RECENT_CAP = 10

export function applyAttempt(
  prev: CalcProblemState,
  attempt: QuestionAttempt,
  withinLimit: boolean,
  _sessionNo: number,
  _today: string,
): CalcProblemState {
  const attemptWithLimit: QuestionAttempt = { ...attempt, withinLimit }
  const nextRecent = [...prev.recentResults, attemptWithLimit].slice(-RECENT_CAP)
  const nextAttemptCount = prev.attemptCount + 1

  let nextProf = prev.proficiency
  let nextConsecutiveWrong = prev.consecutiveWrong
  let nextConsecutiveCorrect = prev.consecutiveCorrect ?? 0
  let nextStatus: CalcProblemStatus = prev.status === 'forced' ? 'forced' : 'active'

  if (attempt.correct && withinLimit) {
    nextProf = Math.min(5, nextProf + 1)
    nextConsecutiveWrong = 0
    nextConsecutiveCorrect = nextConsecutiveCorrect + 1
    if (nextConsecutiveCorrect >= MASTERY_STREAK_K && nextAttemptCount >= MASTERY_STREAK_K) {
      nextStatus = 'mastered'
    } else {
      nextStatus = 'active'
    }
  } else if (attempt.correct && !withinLimit) {
    nextProf = Math.max(0, nextProf - 1)
    nextConsecutiveWrong = 0
    nextConsecutiveCorrect = 0
    nextStatus = 'lagging'
  } else {
    nextProf = Math.max(0, nextProf - 2)
    nextConsecutiveWrong = prev.consecutiveWrong + 1
    nextConsecutiveCorrect = 0
    nextStatus = 'active'
  }

  return {
    ...prev,
    proficiency: nextProf,
    attemptCount: nextAttemptCount,
    appearanceCount: prev.appearanceCount + 1,
    recentResults: nextRecent,
    status: nextStatus,
    consecutiveWrong: nextConsecutiveWrong,
    consecutiveCorrect: nextConsecutiveCorrect,
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
