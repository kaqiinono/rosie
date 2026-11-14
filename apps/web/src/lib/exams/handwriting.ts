import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamHandwritingReview } from '@rosie/exams'
import { ExamApiError, examIdentifier } from './http'
import { attemptCommandHash, attemptUuid, expireAttemptIfNeeded, projectExamAttempt, readAttemptEnvelope } from './attempts'
import { assessmentStorageError } from './recordings'
import { selectedGroups } from './attemptEngine'

export async function readHandwritingAssessment(db: SupabaseClient, ownerId: string, attemptId: string) {
  const current = await readAttemptEnvelope(db, ownerId, attemptId)
  if (!current.handwritingAvailable) throw new ExamApiError('exam_handwriting_unavailable', 409)
  const questions = selectedGroups(current.draft, current.attempt.state)
    .filter(group => current.attempt.state.sections[group.sectionId]?.status === 'submitted').flatMap(group => group.questions)
    .filter(question => {
      const answer = current.attempt.state.answers[question.id]
      return question.answerType === 'gap_fill' && !question.optionPoolId && question.scoring.kind === 'objective'
        && answer?.type === 'gap_fill' && Object.keys(answer.ink ?? {}).length > 0
    })
  const { data, error } = await db.rpc('read_exam_handwriting_reviews', { p_user: ownerId, p_attempt_id: attemptId })
  if (error) assessmentStorageError(error)
  if (!Array.isArray(data) || data.some(value => !value || typeof value !== 'object' || value.attemptId !== attemptId
    || typeof value.id !== 'string' || typeof value.questionId !== 'string' || !['correct', 'incorrect', 'unclear'].includes(value.decision)
    || typeof value.comment !== 'string' || typeof value.reviewedAt !== 'string' || typeof value.actorId !== 'string'
    || typeof value.attemptVersion !== 'string' || (value.points !== null && typeof value.points !== 'number')
    || (value.maxPoints !== null && typeof value.maxPoints !== 'number'))) throw new ExamApiError('exam_unavailable', 503)
  const ids = new Set(questions.map(question => question.id))
  // Only already-submitted questions; never return the private revision or unstarted answers.
  return { version: current.attempt.version, reviews: data.filter(review => ids.has(review.questionId)) as ExamHandwritingReview[],
    references: current.draft.solutions.solutions.filter(solution => ids.has(solution.questionId) && solution.answerType === 'gap_fill')
      .map(solution => ({ questionId: solution.questionId, acceptedAnswerSets: solution.answerType === 'gap_fill' ? solution.acceptedAnswerSets : [] })) }
}

export async function gradeHandwriting(db: SupabaseClient, ownerId: string, actorId: string, attemptId: string, body: Record<string, unknown>) {
  const requestId = attemptUuid(body.requestId)
  const expectedVersion = attemptUuid(body.expectedVersion)
  const questionId = examIdentifier(body.questionId)
  const decision = body.decision
  if (decision !== 'correct' && decision !== 'incorrect' && decision !== 'unclear') throw new ExamApiError('exam_invalid_grade', 400)
  if (typeof body.comment !== 'string' || body.comment.length > 4000) throw new ExamApiError('exam_invalid_grade', 400)
  const current = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, ownerId, attemptId))
  if (!current.handwritingAvailable) throw new ExamApiError('exam_handwriting_unavailable', 409)
  const group = selectedGroups(current.draft, current.attempt.state).find(item => item.questions.some(question => question.id === questionId))
  const question = group?.questions.find(item => item.id === questionId)
  const answer = current.attempt.state.answers[questionId]
  if (!group || !question || question.answerType !== 'gap_fill' || question.optionPoolId || question.scoring.kind !== 'objective'
    || current.attempt.state.sections[group.sectionId]?.status !== 'submitted' || answer?.type !== 'gap_fill'
    || !Object.keys(answer.ink ?? {}).length) throw new ExamApiError('exam_invalid_grade', 409)
  const hash = attemptCommandHash({ kind: 'handwriting', ownerId, actorId, attemptId, expectedVersion, questionId, decision, comment: body.comment })
  // The RPC checks retries before CAS and atomically appends history with the new result.
  const { error } = await db.rpc('grade_exam_handwriting', { p_user: ownerId, p_actor: actorId, p_id: attemptId,
    p_expected_version: expectedVersion, p_request_id: requestId, p_command_hash: hash,
    p_question_id: questionId, p_decision: decision, p_comment: body.comment })
  if (error) assessmentStorageError(error)
  return { attempt: projectExamAttempt(await readAttemptEnvelope(db, ownerId, attemptId)) }
}
