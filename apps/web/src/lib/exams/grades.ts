import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamManualDimension, ExamManualReview, ExamTemplate } from '@rosie/exams'
import { KET_SCHOOLS_2020_TEMPLATE } from '@rosie/exams'
import { ExamApiError, examIdentifier } from './http'
import { attemptCommandHash, attemptUuid, expireAttemptIfNeeded, projectExamAttempt, readAttemptEnvelope } from './attempts'
import { selectedGroups } from './attemptEngine'
import { assessmentStorageError } from './recordings'

export async function readExamManualReviews(db: SupabaseClient, ownerId: string, attemptId: string): Promise<ExamManualReview[]> {
  const { data, error } = await db.rpc('read_exam_manual_reviews', { p_user: ownerId, p_attempt_id: attemptId })
  if (error) assessmentStorageError(error)
  if (!Array.isArray(data) || data.some(value => !value || typeof value !== 'object' || value.attemptId !== attemptId
    || typeof value.id !== 'string' || typeof value.questionId !== 'string' || typeof value.rubricId !== 'string'
    || !Array.isArray(value.dimensions) || typeof value.comment !== 'string' || typeof value.points !== 'number'
    || typeof value.maxPoints !== 'number' || typeof value.actorId !== 'string' || typeof value.reviewedAt !== 'string'
    || typeof value.attemptVersion !== 'string')) throw new ExamApiError('exam_unavailable', 503)
  return data as ExamManualReview[]
}

function comment(value: unknown, max: number): string {
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.length > max) throw new ExamApiError('exam_invalid_grade', 400)
  return value
}

export async function gradeExamAttempt(db: SupabaseClient, ownerId: string, actorId: string, attemptId: string, body: Record<string, unknown>) {
  const requestId = attemptUuid(body.requestId)
  const expectedVersion = attemptUuid(body.expectedVersion)
  const questionId = examIdentifier(body.questionId)
  const current = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, ownerId, attemptId))
  const group = selectedGroups(current.draft, current.attempt.state).find(value => value.questions.some(question => question.id === questionId))
  const question = group?.questions.find(value => value.id === questionId)
  if (!group || !question || question.scoring.kind !== 'manual'
    || current.attempt.state.sections[group.sectionId]?.status !== 'submitted') throw new ExamApiError('exam_invalid_grade', 409)
  const template: ExamTemplate = KET_SCHOOLS_2020_TEMPLATE
  if (current.draft.contentSet.template.id !== template.id || current.draft.contentSet.template.version !== template.version) throw new ExamApiError('exam_rubric_unavailable', 409)
  const rubricId = question.scoring.rubricId
  const rubric = template.rubrics.find(value => value.id === rubricId && value.domain === question.answerType)
  if (!rubric || rubric.dimensions.some(dimension => !dimension.range)) throw new ExamApiError('exam_rubric_unavailable', 409)
  if (!Array.isArray(body.dimensions) || body.dimensions.length !== rubric.dimensions.length) throw new ExamApiError('exam_invalid_grade', 400)
  const entries = new Map<string, ExamManualDimension>()
  for (const raw of body.dimensions as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ExamApiError('exam_invalid_grade', 400)
    const value = raw as Record<string, unknown>
    const dimensionId = examIdentifier(value.dimensionId)
    const dimension = rubric.dimensions.find(value => value.id === dimensionId)
    if (Object.keys(value).some(key => !['dimensionId', 'score', 'comment'].includes(key)) || !dimension?.range
      || entries.has(dimensionId) || typeof value.score !== 'number' || !Number.isFinite(value.score)
      || value.score < dimension.range.min || value.score > dimension.range.max
      || Math.abs(value.score * 100 - Math.round(value.score * 100)) > 1e-8) throw new ExamApiError('exam_invalid_grade', 400)
    entries.set(dimensionId, { dimensionId, score: value.score, comment: comment(value.comment, 2000) })
  }
  const dimensions = rubric.dimensions.map(dimension => entries.get(dimension.id)!)
  const overallComment = comment(body.comment, 4000)
  const points = dimensions.reduce((total, value) => total + Math.round(value.score * 100), 0) / 100
  const maxPoints = rubric.dimensions.reduce((total, value) => total + value.range!.max, 0)
  const commandHash = attemptCommandHash({ ownerId, actorId, attemptId, expectedVersion, questionId, rubricId, dimensions, comment: overallComment })
  const { data, error } = await db.rpc('grade_exam_attempt', { p_user: ownerId, p_actor: actorId, p_id: attemptId,
    p_expected_version: expectedVersion, p_request_id: requestId, p_command_hash: commandHash,
    p_question_id: questionId, p_rubric_id: rubricId, p_dimensions: dimensions, p_comment: overallComment,
    p_points: points, p_max_points: maxPoints })
  if (error) assessmentStorageError(error)
  const reviews = await readExamManualReviews(db, ownerId, attemptId)
  // The immutable attempt version in the audit identifies this exact assessment;
  // retrieve the request-bound version, not an unrelated concurrent latest review.
  const version: unknown = data && typeof data === 'object' && 'attempt' in data
    && data.attempt && typeof data.attempt === 'object' && 'version' in data.attempt ? data.attempt.version : null
  const result = await readAttemptEnvelope(db, ownerId, attemptId)
  const review = reviews.find(value => value.questionId === questionId && value.attemptVersion === version)
  if (!review) throw new ExamApiError('exam_unavailable', 503)
  return { attempt: projectExamAttempt(result), review }
}
