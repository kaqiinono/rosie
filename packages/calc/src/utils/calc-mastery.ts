import type { CalcProblemState, CalcProblemStatus, QuestionAttempt } from '@rosie/core'

export type LearningStatus = 'unseen' | 'learning' | 'fluent' | 'mastered' | 'review-due'

export interface MasteryTransition {
  proficiency: number
  consecutiveCorrect: number
  consecutiveWrong: number
  status: CalcProblemStatus
  learningStatus: LearningStatus
}

function isFullEvidence(attempt: QuestionAttempt): boolean {
  return attempt.evidenceKind !== 'makeup'
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
  const qualified = recent.filter(
    (attempt) => attempt.correct && attempt.withinLimit === true && isFullEvidence(attempt),
  )
  const hasV2 = recent.some(
    (attempt) => attempt.sessionNo !== undefined || attempt.date !== undefined,
  )
  const hasLegacy = recent.some(
    (attempt) => attempt.sessionNo === undefined && attempt.date === undefined,
  )
  const sessions = new Set(
    qualified.map((attempt) => attempt.sessionNo).filter((value) => value !== undefined),
  )
  const dates = new Set(
    qualified.map((attempt) => attempt.date).filter((value) => value !== undefined),
  )
  const fluent = qualified.length >= 3 && sessions.size >= 2
  const mastered = fluent && dates.size >= 2
  const regressed =
    state.status === 'lagging' || state.consecutiveWrong > 0 || latest?.correct === false
  if (regressed) {
    return fluent || state.proficiency >= 3 || state.status === 'mastered'
      ? 'review-due'
      : 'learning'
  }
  if (mastered) return 'mastered'
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
  const fullEvidence = isFullEvidence(attempt)
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
