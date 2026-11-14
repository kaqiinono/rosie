import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { EXAM_REFLECTION_REASONS, type ExamReflectionCommand, type ExamReflectionList,
  type ExamReflectionReason, type ExamQuestionReflectionRecord } from '@rosie/exams/reflection'
import { ExamApiError, examIdentifier, readExamJsonBody } from './http'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reasonIsValid = (value: unknown): value is ExamReflectionReason | null => value === null
  || (typeof value === 'string' && EXAM_REFLECTION_REASONS.some(reason => reason === value))

export function parseExamReflectionCommand(input: unknown): ExamReflectionCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExamApiError('exam_invalid_request', 400)
  const value = input as Record<string, unknown>
  const fields = ['requestId', 'questionId', 'expectedVersion', 'reason']
  if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))
    || typeof value.requestId !== 'string' || !UUID.test(value.requestId)
    || (value.expectedVersion !== null && (typeof value.expectedVersion !== 'string' || !UUID.test(value.expectedVersion)))
    || !reasonIsValid(value.reason)) throw new ExamApiError('exam_invalid_request', 400)
  return { requestId: value.requestId, questionId: examIdentifier(value.questionId),
    expectedVersion: value.expectedVersion, reason: value.reason }
}

export async function readExamReflectionCommand(request: Request): Promise<ExamReflectionCommand> {
  return parseExamReflectionCommand(await readExamJsonBody(request))
}

function storageError(error: { message?: string }): never {
  const codes: Record<string, number> = { exam_not_found: 404, exam_conflict: 409, exam_invalid_request: 400, exam_reflection_unavailable: 403 }
  if (error.message && Object.hasOwn(codes, error.message)) throw new ExamApiError(error.message, codes[error.message])
  throw new ExamApiError('exam_unavailable', 503)
}

function record(input: unknown): ExamQuestionReflectionRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExamApiError('exam_unavailable', 503)
  const value = input as Record<string, unknown>
  if (Object.keys(value).length !== 3 || typeof value.questionId !== 'string'
    || typeof value.version !== 'string' || !UUID.test(value.version) || !reasonIsValid(value.reason)) throw new ExamApiError('exam_unavailable', 503)
  return { questionId: value.questionId, reason: value.reason, version: value.version }
}

export async function readExamReflections(db: SupabaseClient, userId: string, attemptId: string): Promise<ExamReflectionList> {
  const { data, error } = await db.rpc('read_exam_reflections', { p_user: userId, p_attempt_id: attemptId })
  if (error) storageError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
  const value = data as Record<string, unknown>
  if (!Array.isArray(value.items)) throw new ExamApiError('exam_unavailable', 503)
  const items = value.items.map(record)
  if (new Set(items.map(item => item.questionId)).size !== items.length) throw new ExamApiError('exam_unavailable', 503)
  return { items }
}

export async function saveExamReflection(db: SupabaseClient, userId: string, attemptId: string, command: ExamReflectionCommand): Promise<ExamQuestionReflectionRecord> {
  const { data, error } = await db.rpc('save_exam_reflection', { p_user: userId, p_attempt_id: attemptId, p_request_id: command.requestId,
    p_question_id: command.questionId, p_expected_version: command.expectedVersion, p_reason: command.reason })
  if (error) storageError(error)
  const saved = record(data)
  if (saved.questionId !== command.questionId) throw new ExamApiError('exam_unavailable', 503)
  return saved
}
