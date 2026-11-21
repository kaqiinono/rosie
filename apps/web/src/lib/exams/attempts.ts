import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamAttemptRecord, ExamAttemptState, ExamAttemptView, ExamAttemptReview, ExamAttemptListItem, MediaSlot } from '@rosie/exams'
import { validateExamDraft, type ExamDraftInput } from '@rosie/exams/validation'
import { ExamApiError, examIdentifier, readExamJsonBody } from './http'
import { applyExamOperation, newExamAttempt, selectedGroups, type AttemptOperation, type AttemptCommand } from './attemptEngine'
import { verifyExamMediaForAttempt } from './media'
import { followSupersededExamRevision } from './repository'

export interface AttemptEnvelope { handwritingAvailable?: boolean; annotationPersistence?: boolean; attempt: ExamAttemptRecord; draft: ExamDraftInput; serverNow: string }
export interface AttemptWriteCommand extends AttemptCommand { requestId: string; expectedVersion: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function attemptUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ExamApiError('exam_invalid_id', 400)
  return value
}
export function attemptStorageError(error: { message?: string }): never {
  const codes: Record<string, number> = { exam_not_found: 404, exam_conflict: 409, exam_expired: 409,
    exam_invalid_transition: 409, exam_invalid_request: 400, exam_content_unavailable: 409,
    exam_forbidden: 403, exam_playback_unavailable: 409, exam_recording_incomplete: 409,
    exam_invalid_attempt: 400, exam_invalid_mode: 400, exam_invalid_answer: 400,
    exam_interrupted: 409, exam_help_unavailable: 403, exam_script_unavailable: 403 }
  if (error.message && Object.hasOwn(codes, error.message)) throw new ExamApiError(error.message, codes[error.message])
  throw new ExamApiError('exam_unavailable', 503)
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_unavailable', 503)
  return value as Record<string, unknown>
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export function attemptCommandHash(value: unknown) { return createHash('sha256').update(stable(value)).digest('hex') }

function envelope(data: unknown, userId: string, id?: string): AttemptEnvelope {
  const value = object(data)
  const attempt = object(value.attempt)
  const state = object(attempt.state)
  if (attempt.userId !== userId || (id && attempt.id !== id) || typeof attempt.id !== 'string'
    || typeof attempt.version !== 'string' || typeof attempt.contentRevisionId !== 'string'
    || state.schemaVersion !== 1 || !['practice', 'mock'].includes(String(state.mode)) || !Array.isArray(state.groupIds)
    || typeof value.serverNow !== 'string' || !Number.isFinite(Date.parse(value.serverNow))) throw new ExamApiError('exam_unavailable', 503)
  const stored = object(value.draft)
  const result = validateExamDraft({ ...stored, content: { ...object(stored.content), status: 'draft' } })
  if (!result.ok || result.value.content.id !== attempt.contentRevisionId) throw new ExamApiError('exam_unavailable', 503)
  return { attempt: attempt as unknown as ExamAttemptRecord, draft: result.value, serverNow: value.serverNow }
}

async function annotationPersistenceAvailable(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc('exam_sentence_annotations_ready')
  if (error?.code === 'PGRST202' || error?.code === '42883') return false
  if (error) attemptStorageError(error)
  return data === true
}

async function handwritingAvailable(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc('exam_handwriting_ready')
  if (error?.code === 'PGRST202' || error?.code === '42883') return false
  if (error) attemptStorageError(error)
  return data === true
}

async function attemptCapabilities(db: SupabaseClient) {
  const [annotations, handwriting] = await Promise.all([annotationPersistenceAvailable(db), handwritingAvailable(db)])
  return { annotationPersistence: annotations, handwritingAvailable: handwriting }
}

export async function readAttemptEnvelope(db: SupabaseClient, userId: string, id: string): Promise<AttemptEnvelope> {
  const { data, error } = await db.rpc('read_exam_attempt', { p_user: userId, p_id: id })
  if (error) attemptStorageError(error)
  return { ...envelope(data, userId, id), ...await attemptCapabilities(db) }
}

export async function priorAttemptCommand(db: SupabaseClient, userId: string, requestId: string, commandHash: string): Promise<string | null> {
  const { data, error } = await db.rpc('find_exam_attempt_request', { p_user: userId, p_request_id: requestId, p_command_hash: commandHash })
  if (error) attemptStorageError(error)
  if (data === null) return null
  const result = object(data)
  if (typeof result.attemptId !== 'string') throw new ExamApiError('exam_unavailable', 503)
  return result.attemptId
}

export async function checkAttemptMedia(db: SupabaseClient, data: AttemptEnvelope, sectionId?: string): Promise<number | null> {
  const bindingId = data.attempt.mediaBindingRevisionId
  const slots = data.draft.content.mediaSlots
  if (!bindingId) {
    if (slots.some(slot => slot.required)) throw new ExamApiError('exam_playback_unavailable', 409)
    return null
  }
  return (await verifyExamMediaForAttempt(db, data.draft, bindingId, sectionId)).listeningDurationMs
}

export async function createExamAttempt(db: SupabaseClient, userId: string, body: Record<string, unknown>): Promise<AttemptEnvelope> {
  if (Object.keys(body).some(key => !['requestId', 'contentRevisionId', 'mode', 'groupId', 'wordReviewBatchId'].includes(key))
    || (body.mode !== 'practice' && body.mode !== 'mock') || (body.mode === 'mock' && body.groupId !== undefined)) throw new ExamApiError('exam_invalid_request', 400)
  const requestId = attemptUuid(body.requestId)
  const wordReviewBatchId = body.wordReviewBatchId === undefined ? undefined : attemptUuid(body.wordReviewBatchId)
  if (wordReviewBatchId && body.mode !== 'practice') throw new ExamApiError('exam_invalid_mode', 400)
  const requestedRevisionId = examIdentifier(body.contentRevisionId)
  const groupId = body.mode === 'practice' ? examIdentifier(body.groupId) : undefined
  const hash = attemptCommandHash({ userId, operation: 'create', body })
  const previous = await priorAttemptCommand(db, userId, requestId, hash)
  if (previous) return readAttemptEnvelope(db, userId, previous)
  let revisionId = requestedRevisionId
  const requested = await db.rpc('read_exam_publication', { p_id: revisionId })
  if (requested.error) attemptStorageError(requested.error)
  let publication = object(requested.data)
  if (publication.status === 'withdrawn') {
    revisionId = await followSupersededExamRevision(db, revisionId)
    if (revisionId !== requestedRevisionId) {
      const current = await db.rpc('read_exam_publication', { p_id: revisionId })
      if (current.error) attemptStorageError(current.error)
      publication = object(current.data)
    }
  }
  if (publication.status !== 'published') throw new ExamApiError('exam_content_unavailable', 409)
  const stored = object(publication.draft)
  const validation = validateExamDraft({ ...stored, content: { ...object(stored.content), status: 'draft' } })
  if (!validation.ok) throw new ExamApiError('exam_content_unavailable', 503)
  const draft = validation.value
  if (draft.content.mediaBindingRevisionId) await verifyExamMediaForAttempt(db, draft, draft.content.mediaBindingRevisionId)
  else if (draft.content.mediaSlots.some(slot => slot.required)) throw new ExamApiError('exam_playback_unavailable', 409)
  if (groupId && !draft.content.groups.some(group => group.id === groupId)) throw new ExamApiError('exam_content_unavailable', 409)
  const state = newExamAttempt(draft, body.mode, groupId, new Date().toISOString())
  const created = await db.rpc(wordReviewBatchId ? 'create_exam_transfer_attempt' : 'create_exam_attempt', { p_user: userId, p_request_id: requestId, p_content_revision_id: revisionId,
    p_state: state, p_command_hash: hash, ...(wordReviewBatchId ? { p_batch_id: wordReviewBatchId } : {}) })
  if (created.error) attemptStorageError(created.error)
  return { ...envelope(created.data, userId), ...await attemptCapabilities(db) }
}

async function assertRecordingsComplete(db: SupabaseClient, current: AttemptEnvelope, next: ExamAttemptState) {
  const scope = selectedGroups(current.draft, next).filter(group => group.sectionId === current.attempt.state.currentSectionId)
  const questions = scope.flatMap(group => group.questions).filter(question => question.answerType === 'speaking' && question.scoring.kind !== 'example')
  for (const question of questions) {
    const answer = next.answers[question.id]
    // No recording started is an unanswered task; only an explicit abandoned answer
    // acknowledges an upload which the learner chose not to finish.
    const query = await db.from('exam_recordings').select('id,status').eq('user_id', current.attempt.userId).eq('attempt_id', current.attempt.id).eq('question_id', question.id)
    if (query.error) attemptStorageError(query.error)
    const rows = (query.data ?? []) as { id: string; status: string }[]
    if (answer?.type === 'speaking' && answer.abandoned) continue
    if (rows.some(row => row.status === 'uploading')) throw new ExamApiError('exam_recording_incomplete', 409)
    if (answer?.type === 'speaking' && answer.recordingIds.some(id => !rows.some(row => row.id === id && row.status === 'complete'))) throw new ExamApiError('exam_recording_incomplete', 409)
  }
}

export async function commitAttemptState(db: SupabaseClient, current: AttemptEnvelope, operation: AttemptOperation,
  next: ExamAttemptState, exposureGroupIds: string[], requestId: string, commandHash: string, actorId = current.attempt.userId): Promise<AttemptEnvelope> {
  const { data, error } = await db.rpc('commit_exam_attempt', {
    p_user: current.attempt.userId, p_id: current.attempt.id, p_expected_version: current.attempt.version,
    p_request_id: requestId, p_operation: operation, p_state: next, p_exposure_group_ids: exposureGroupIds,
    p_command_hash: commandHash, p_actor: actorId,
  })
  if (error) attemptStorageError(error)
  return { ...envelope(data, current.attempt.userId, current.attempt.id), annotationPersistence: current.annotationPersistence, handwritingAvailable: current.handwritingAvailable }
}

export async function expireAttemptIfNeeded(db: SupabaseClient, data: AttemptEnvelope): Promise<AttemptEnvelope> {
  const { state } = data.attempt
  const section = state.currentSectionId ? state.sections[state.currentSectionId] : null
  if (!section || section.status !== 'active' || !section.deadlineAt || Date.parse(section.deadlineAt) > Date.parse(data.serverNow)) return data
  const next = applyExamOperation(data.draft, state, 'expire', {}, data.serverNow)
  const requestId = randomUUID()
  try {
    return await commitAttemptState(db, data, 'expire', next.state, [], requestId, attemptCommandHash({ id: data.attempt.id, version: data.attempt.version, operation: 'expire' }))
  } catch (error) {
    if (error instanceof ExamApiError && error.code === 'exam_conflict') return readAttemptEnvelope(db, data.attempt.userId, data.attempt.id)
    throw error
  }
}

export async function mutateExamAttempt(db: SupabaseClient, userId: string, id: string, operation: AttemptOperation, command: AttemptWriteCommand): Promise<AttemptEnvelope> {
  const hash = attemptCommandHash({ userId, id, operation, command })
  const prior = await priorAttemptCommand(db, userId, command.requestId, hash)
  if (prior) {
    if (prior !== id) throw new ExamApiError('exam_conflict', 409)
    return expireAttemptIfNeeded(db, await readAttemptEnvelope(db, userId, id))
  }
  const current = await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, userId, id))
  if (current.attempt.version !== command.expectedVersion) throw new ExamApiError('exam_conflict', 409)
  if (command.annotations !== undefined && !current.annotationPersistence) throw new ExamApiError('exam_annotations_unavailable', 409)
  const duration = operation === 'start' || operation === 'resume' ? await checkAttemptMedia(db, current, command.sectionId ?? current.attempt.state.currentSectionId ?? undefined) : null
  const next = applyExamOperation(current.draft, current.attempt.state, operation, command, current.serverNow, duration)
  if (!current.handwritingAvailable && command.answers !== undefined && Object.values(next.state.answers).some(answer => answer.type === 'gap_fill' && Object.keys(answer.ink ?? {}).length)) throw new ExamApiError('exam_handwriting_unavailable', 409)
  if (operation === 'submit') await assertRecordingsComplete(db, current, next.state)
  try { return await commitAttemptState(db, current, operation, next.state, next.exposureGroupIds, command.requestId, hash) }
  catch (error) {
    if (error instanceof ExamApiError && error.code === 'exam_expired') await expireAttemptIfNeeded(db, await readAttemptEnvelope(db, userId, id))
    throw error
  }
}

export function projectExamAttempt(data: AttemptEnvelope): ExamAttemptView {
  const { attempt, draft } = data
  const sections = attempt.state.sections
  const groups = selectedGroups(draft, attempt.state).filter(group => sections[group.sectionId]?.status !== 'not_started')
  const materialIds = new Set(groups.flatMap(group => [...group.materialIds]))
  const groupIds = new Set(groups.map(group => group.id))
  const visibleSlots = new Set<string>()
  const blocks = [...draft.content.materials.filter(material => materialIds.has(material.id)).flatMap(material => [...material.blocks]),
    ...groups.flatMap(group => [...group.instructions, ...group.questions.flatMap(question => [...question.prompt,
      ...(question.answerType === 'matching' ? question.items.flatMap(item => [...item.prompt]) : [])])])]
  blocks.forEach(block => { if (block.kind === 'image' || block.kind === 'audio') visibleSlots.add(block.mediaSlotId) })
  groups.forEach(group => {
    group.optionPools.forEach(pool => pool.options.forEach(option => { if (option.imageSlotId) visibleSlots.add(option.imageSlotId) }))
    group.questions.forEach(question => {
      if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') question.options.forEach(option => { if (option.imageSlotId) visibleSlots.add(option.imageSlotId) })
    })
  })
  const mediaSlots: readonly MediaSlot<'student'>[] = draft.content.mediaSlots.filter(slot => visibleSlots.has(slot.id)
    || (slot.target.kind === 'group' && groupIds.has(slot.target.id))
    || (slot.target.kind === 'content_set' && slot.purpose === 'exam_listening' && sections.listening?.status !== 'not_started' && !!sections.listening))
  const exposedQuestions = new Set(groups.filter(group => sections[group.sectionId]?.status === 'submitted').flatMap(group => group.questions.map(question => question.id)))
  const state = { ...attempt.state, scriptGrant: null }
  return { handwritingAvailable: data.handwritingAvailable === true, annotationPersistence: data.annotationPersistence === true, id: attempt.id, version: attempt.version, title: draft.contentSet.title, serverNow: data.serverNow, state,
    groups, materials: draft.content.materials.filter(material => materialIds.has(material.id)), mediaSlots,
    vocabularyLinks: draft.content.vocabularyLinks.filter(link => link.questionIds.every(id => exposedQuestions.has(id))) }
}

export function projectAttemptReview(data: AttemptEnvelope, helpedQuestionId?: string): ExamAttemptReview {
  const groups = selectedGroups(data.draft, data.attempt.state)
  const submittedGroups = new Set(groups.filter(group => data.attempt.state.sections[group.sectionId]?.status === 'submitted').map(group => group.id))
  const allowed = new Set<string>(groups.filter(group => submittedGroups.has(group.id)).flatMap(group => group.questions.map(question => question.id)))
  if (helpedQuestionId && data.attempt.state.mode === 'practice' && data.attempt.state.helpQuestionIds.includes(helpedQuestionId)) allowed.add(helpedQuestionId)
  const guidanceGroups = new Set(groups.filter(group => submittedGroups.has(group.id)
    || (data.attempt.state.mode === 'practice' && group.questions.some(question => question.id === helpedQuestionId && allowed.has(question.id)))).map(group => group.id))
  const guidance = data.draft.content.guidance.filter(item => item.groupIds.length > 0 && item.groupIds.every(id => guidanceGroups.has(id)))
  const listeningTranscripts = data.draft.solutions.teacherNotes.filter(note => note.kind === 'listening_transcript'
    && note.sectionId === 'listening' && note.groupIds.length > 0 && note.groupIds.every(id => submittedGroups.has(id)))
  const reviewNotes = new Set(listeningTranscripts.map(note => note.id))
  const reviewGuidance = new Set(data.draft.content.guidance.filter(item => item.groupIds.length > 0 && item.groupIds.every(id => submittedGroups.has(id))).map(item => item.id))
  const mediaSlots = data.draft.solutions.mediaSlots.filter((slot): slot is MediaSlot<'review'> => slot.audience === 'review' && (
    slot.target.kind === 'group' ? submittedGroups.has(slot.target.id)
      : slot.target.kind === 'teacher_notes' ? reviewNotes.has(slot.target.id)
        : slot.target.kind === 'guidance' ? reviewGuidance.has(slot.target.id)
          : data.draft.content.groups.every(group => submittedGroups.has(group.id))))
  return { id: data.attempt.id, solutions: data.draft.solutions.solutions.filter(solution => allowed.has(solution.questionId)),
    results: Object.fromEntries(Object.entries(data.attempt.state.results).filter(([id]) => allowed.has(id))),
    vocabularyLinks: data.draft.content.vocabularyLinks.filter(link => link.questionIds.every(id => allowed.has(id))),
    guidance, listeningTranscripts, mediaSlots }
}

export async function readAttemptCommand(request: Request, operation: AttemptOperation): Promise<AttemptWriteCommand> {
  const input = await readExamJsonBody(request)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExamApiError('exam_invalid_request', 400)
  const body = input as Record<string, unknown>
  const fields: Record<string, readonly string[]> = {
    save: ['answers', 'annotations', 'groupId', 'playbackPositionMs'], submit: ['answers', 'annotations'], start: ['sectionId'], help: ['questionId'], interrupt: [], resume: [],
  }
  const allowed = ['requestId', 'expectedVersion', ...(fields[operation] ?? [])]
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new ExamApiError('exam_invalid_request', 400)
  const result: AttemptWriteCommand = { requestId: attemptUuid(body.requestId), expectedVersion: attemptUuid(body.expectedVersion) }
  for (const key of ['groupId', 'sectionId', 'questionId'] as const) if (body[key] !== undefined) result[key] = examIdentifier(body[key])
  if (body.answers !== undefined) result.answers = body.answers
  if (body.annotations !== undefined) result.annotations = body.annotations
  if (body.playbackPositionMs !== undefined) {
    if (typeof body.playbackPositionMs !== 'number') throw new ExamApiError('exam_invalid_request', 400)
    result.playbackPositionMs = body.playbackPositionMs
  }
  return result
}

export async function listExamAttempts(db: SupabaseClient, userId: string): Promise<ExamAttemptListItem[]> {
  const { data, error } = await db.from('exam_attempts').select('id,content_revision_id,state,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(100)
  if (error) attemptStorageError(error)
  const rows = (data ?? []) as { id: string; content_revision_id: string; state: ExamAttemptState; updated_at: string }[]
  const ids = [...new Set(rows.map(row => row.content_revision_id))]
  if (!ids.length) return []
  const revisions = await db.from('exam_content_revisions').select('id,set_snapshot').in('id', ids)
  if (revisions.error) attemptStorageError(revisions.error)
  const titles = new Map((revisions.data ?? []).map(row => [row.id as string, (row.set_snapshot as { title: string }).title]))
  return rows.map(row => ({ id: row.id, title: titles.get(row.content_revision_id) ?? '考试记录', mode: row.state.mode,
    updatedAt: row.updated_at, status: Object.values(row.state.sections).every(section => section.status === 'submitted')
      ? Object.values(row.state.results).some(result => result.outcome === 'pending') ? 'pending_review' : 'completed'
      : row.state.currentSectionId ? 'active' : 'ready' }))
}
