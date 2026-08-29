import type { CalcProblemState, CalcProblemStatus, QuestionAttempt } from '@rosie/core'
import type { LearningStatus } from './calc-coverage'
import { isIndependentEvidence, isMasteryEvidence } from './calc-evidence'

export interface MasteryTransition {
  proficiency: number
  consecutiveCorrect: number
  consecutiveWrong: number
  status: CalcProblemStatus
  learningStatus: LearningStatus
}

function isFluentAt(attempts: QuestionAttempt[], endIndex: number): boolean {
  const independent = attempts.slice(0, endIndex + 1).filter(isIndependentEvidence)
  const latestFour = independent.slice(-4)
  const latestTwo = independent.slice(-2)
  const correctInFour = latestFour.filter((attempt) => attempt.correct).length
  const sessions = new Set(
    latestFour.map((attempt) => attempt.sessionNo).filter((value) => value !== undefined),
  )
  return (
    latestFour.length >= 3 &&
    correctInFour >= 3 &&
    latestTwo.length === 2 &&
    latestTwo.every((attempt) => attempt.correct && attempt.withinLimit === true) &&
    sessions.size >= 2
  )
}

function hasSpacedRecallAfterFluent(attempts: QuestionAttempt[]): boolean {
  for (let index = 1; index < attempts.length; index++) {
    const recall = attempts[index]
    if (
      recall.evidenceKind !== 'recall' ||
      !recall.correct ||
      recall.withinLimit !== true ||
      !recall.date
    ) {
      continue
    }
    const prior = attempts.slice(0, index)
    if (!isFluentAt(prior, prior.length - 1)) continue
    const priorDates = prior.map((attempt) => attempt.date).filter((date): date is string => !!date)
    if (priorDates.some((date) => date < recall.date!)) return true
  }
  return false
}

export function learningStatusFromEvidence(
  state: Pick<
    CalcProblemState,
    'appearanceCount' | 'recentResults' | 'status' | 'proficiency' | 'consecutiveWrong'
  >,
): LearningStatus {
  if (state.appearanceCount <= 0) return 'unseen'
  const recent = state.recentResults
  const latest = recent.at(-1)
  const hasV2 = recent.some(
    (attempt) => attempt.sessionNo !== undefined || attempt.date !== undefined,
  )
  const hasLegacy = recent.some(
    (attempt) => attempt.sessionNo === undefined && attempt.date === undefined,
  )
  const fluent = recent.length > 0 && isFluentAt(recent, recent.length - 1)
  const wasFluent = recent.length > 1 && isFluentAt(recent, recent.length - 2)
  const mastered = hasSpacedRecallAfterFluent(recent)
  const regressed =
    state.status === 'lagging' || state.consecutiveWrong > 0 || latest?.correct === false
  if (regressed) {
    return fluent || wasFluent || state.proficiency >= 3 || state.status === 'mastered'
      ? 'review-due'
      : 'learning'
  }
  if (mastered || (state.status === 'mastered' && !regressed)) return 'mastered'
  if (fluent) return 'fluent'
  if ((!hasV2 || hasLegacy) && state.status === 'mastered') return 'mastered'
  if (!hasV2 && state.proficiency >= 4 && recent.length >= 3) return 'fluent'
  return 'learning'
}

export function nextMasteryTransition(
  previous: CalcProblemState,
  recentResults: QuestionAttempt[],
  attempt: QuestionAttempt,
): MasteryTransition {
  const fullEvidence = isMasteryEvidence(attempt)
  let proficiency = previous.proficiency
  let consecutiveCorrect = previous.consecutiveCorrect ?? 0
  let consecutiveWrong = previous.consecutiveWrong
  let status: CalcProblemStatus = previous.status === 'forced' ? 'forced' : 'active'

  if (attempt.correct && attempt.withinLimit) {
    consecutiveWrong = 0
    if (fullEvidence) {
      proficiency = Math.min(5, proficiency + 1)
      consecutiveCorrect += 1
    }
  } else if (attempt.correct) {
    consecutiveWrong = 0
    consecutiveCorrect = 0
    if (fullEvidence) proficiency = Math.max(0, proficiency - 1)
    status = 'lagging'
  } else {
    proficiency = Math.max(0, proficiency - 2)
    consecutiveWrong += 1
    consecutiveCorrect = 0
  }

  const provisional = {
    ...previous,
    appearanceCount: previous.appearanceCount + 1,
    recentResults,
    proficiency,
    consecutiveWrong,
    status,
  }
  const learningStatus = learningStatusFromEvidence(provisional)
  if (learningStatus === 'mastered') status = 'mastered'
  else if (learningStatus === 'review-due' && attempt.correct && !attempt.withinLimit)
    status = 'lagging'

  return { proficiency, consecutiveCorrect, consecutiveWrong, status, learningStatus }
}
