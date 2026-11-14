import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  describeExamPublicationReadiness, validateExamDraft,
  type ExamCurrentReviews, type ExamDraftInput, type ExamPublicationReceipt,
  type ExamPublicationState, type ExamReviewDecision, type ExamReviewRecord, type ExamReviewScope,
} from '@rosie/exams/validation'
import { ExamApiError } from './http'
import { verifyExamMediaForPublication } from './media'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCOPES = ['exam', 'explanations', 'rubric'] as const

export interface ExamPublicationCommand { expectedVersion: string; requestId: string }
export interface ExamReviewCommand extends ExamPublicationCommand {
  scope: ExamReviewScope
  decision: ExamReviewDecision
  reason?: string
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_unavailable', 503)
  return value as Record<string, unknown>
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ExamApiError('exam_unavailable', 503)
  return value
}

function date(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !Number.isFinite(Date.parse(value))) throw new ExamApiError('exam_unavailable', 503)
  return value
}

function storageError(error: { message?: string }): never {
  const codes: Record<string, number> = {
    exam_not_found: 404, exam_conflict: 409, exam_not_editable: 409,
    exam_review_changed: 409, exam_publication_blocked: 409,
    exam_invalid_request: 400, exam_invalid_vocabulary_reference: 422,
    exam_listening_program_missing: 409,
  }
  if (error.message && Object.hasOwn(codes, error.message)) throw new ExamApiError(error.message, codes[error.message])
  throw new ExamApiError('exam_unavailable', 503)
}

async function readCommand(request: Request, review: boolean): Promise<ExamReviewCommand | ExamPublicationCommand> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ExamApiError('exam_json_required', 415)
  }
  if (!request.body) throw new ExamApiError('exam_invalid_json', 400)
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  let input: unknown
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 16_384) {
        await reader.cancel()
        throw new ExamApiError('exam_payload_too_large', 413)
      }
      text += decoder.decode(next.value, { stream: true })
    }
    input = JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    if (error instanceof ExamApiError) throw error
    throw new ExamApiError('exam_invalid_json', 400)
  } finally { reader.releaseLock() }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExamApiError('exam_invalid_request', 400)
  const body = input as Record<string, unknown>
  const allowed = review ? ['expectedVersion', 'requestId', 'scope', 'decision', 'reason'] : ['expectedVersion', 'requestId']
  if (Object.keys(body).some(key => !allowed.includes(key)) || typeof body.expectedVersion !== 'string'
    || !UUID.test(body.expectedVersion) || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
    throw new ExamApiError('exam_invalid_request', 400)
  }
  const command = { expectedVersion: body.expectedVersion, requestId: body.requestId }
  if (!review) return command
  if ((body.scope !== 'exam' && body.scope !== 'explanations' && body.scope !== 'rubric')
    || (body.decision !== 'approved' && body.decision !== 'blocked')
    || (Object.hasOwn(body, 'reason') && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 2000))
    || (body.decision === 'blocked' && typeof body.reason !== 'string')) {
    throw new ExamApiError('exam_invalid_request', 400)
  }
  return { ...command, scope: body.scope, decision: body.decision, ...(typeof body.reason === 'string' ? { reason: body.reason } : {}) }
}

export async function readExamReviewCommand(request: Request): Promise<ExamReviewCommand> {
  return await readCommand(request, true) as ExamReviewCommand
}

export async function readExamPublicationCommand(request: Request): Promise<ExamPublicationCommand> {
  return readCommand(request, false)
}

function reviewRecord(value: unknown, id: string, version: string, scope: ExamReviewScope): ExamReviewRecord | null {
  if (value === null) return null
  const row = object(value)
  if (row.contentRevisionId !== id || row.contentVersion !== version || row.scope !== scope
    || (row.decision !== 'approved' && row.decision !== 'blocked')
    || (row.reason !== null && (typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 2000))
    || (row.decision === 'blocked' && row.reason === null)) throw new ExamApiError('exam_unavailable', 503)
  return {
    id: uuid(row.id), contentRevisionId: id, contentVersion: version, scope,
    decision: row.decision, reason: row.reason as string | null,
    actorId: uuid(row.actorId), reviewedAt: date(row.reviewedAt),
  }
}

async function vocabularyIsCurrent(db: SupabaseClient, draft: ExamDraftInput): Promise<boolean> {
  const ids = [...new Set(draft.content.vocabularyLinks.map(link => link.wordEntryId.toLowerCase()))]
  const entries = new Map<string, Record<string, unknown>>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await db.from('word_entries').select('id,stage,unit,lesson,word').in('id', ids.slice(offset, offset + 100))
    if (error) storageError(error)
    if (!Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
    for (const value of data as unknown[]) {
      const entry = object(value)
      if (typeof entry.id !== 'string') throw new ExamApiError('exam_unavailable', 503)
      entries.set(entry.id.toLowerCase(), entry)
    }
  }
  return draft.content.vocabularyLinks.every(link => {
    const entry = entries.get(link.wordEntryId.toLowerCase())
    return entry && ['stage', 'unit', 'lesson', 'word'].every(key => entry[key] === link.sourceSnapshot[key as keyof typeof link.sourceSnapshot])
  })
}

async function loadPublication(db: SupabaseClient, id: string): Promise<{ state: ExamPublicationState; draft: ExamDraftInput }> {
  const { data, error } = await db.rpc('read_exam_publication', { p_id: id })
  if (error) storageError(error)
  const row = object(data)
  if (row.id !== id || (row.status !== 'draft' && row.status !== 'published' && row.status !== 'withdrawn')) {
    throw new ExamApiError('exam_unavailable', 503)
  }
  const version = uuid(row.version)
  const stored = object(row.draft)
  const storedContent = object(stored.content)
  if (storedContent.status !== row.status) throw new ExamApiError('exam_unavailable', 503)
  // Validate the immutable authoring envelope without granting clients approved status.
  const validation = validateExamDraft({ ...stored, content: { ...storedContent, status: 'draft' } })
  if (!validation.ok || validation.value.content.id !== id) throw new ExamApiError('exam_unavailable', 503)
  const sourceReviews = object(row.reviews)
  const reviews: ExamCurrentReviews = { exam: null, explanations: null, rubric: null }
  for (const scope of SCOPES) reviews[scope] = reviewRecord(sourceReviews[scope], id, version, scope)
  let media: Awaited<ReturnType<typeof verifyExamMediaForPublication>> = undefined
  let mediaFailed = false
  try { media = await verifyExamMediaForPublication(db, validation.value) }
  catch { mediaFailed = true }
  const readiness = describeExamPublicationReadiness(validation.value, { version, reviews, media })
  if (mediaFailed) {
    readiness.exam.push({ path: '$.content.mediaBindingRevisionId', code: 'exam_media_unavailable', message: 'The current binding could not be verified against the shared account and live files.' })
  }
  if (!await vocabularyIsCurrent(db, validation.value)) {
    readiness.exam.push({ path: '$.content.vocabularyLinks', code: 'exam_invalid_vocabulary_reference', message: 'Vocabulary references must match the current canonical entries.' })
  }
  if (row.status !== 'draft') readiness.canPublish = false
  return { state: { id, version, status: row.status, reviews, readiness }, draft: validation.value }
}

export async function readExamPublication(db: SupabaseClient, id: string): Promise<ExamPublicationState> {
  return (await loadPublication(db, id)).state
}

export async function recordExamReview(db: SupabaseClient, id: string, actorId: string, command: ExamReviewCommand): Promise<ExamPublicationState> {
  const { error } = await db.rpc('record_exam_review', {
    p_id: id, p_expected_version: command.expectedVersion, p_request_id: command.requestId,
    p_actor: actorId, p_scope: command.scope, p_decision: command.decision, p_reason: command.reason ?? null,
  })
  if (error) storageError(error)
  return readExamPublication(db, id)
}

export async function transitionExamPublication(
  db: SupabaseClient, id: string, actorId: string, action: 'publish' | 'withdraw' | 'reopen', command: ExamPublicationCommand,
): Promise<ExamPublicationReceipt> {
  const state = action === 'publish' ? await readExamPublication(db, id) : null
  const { data, error } = await db.rpc('transition_exam_publication', {
    p_id: id, p_expected_version: command.expectedVersion, p_request_id: command.requestId, p_actor: actorId, p_action: action,
    p_review_ids: state ? Object.fromEntries(SCOPES.map(scope => [scope, state.reviews[scope]?.id ?? null])) : {},
    p_ready: true,
  })
  if (error) {
    if (error.message === 'exam_publication_blocked' && state) {
      throw new ExamApiError('exam_publication_blocked', 409, [...state.readiness.exam, ...state.readiness.explanations].slice(0, 100))
    }
    storageError(error)
  }
  const row = object(data)
  const status = action === 'publish' ? 'published' : action === 'reopen' ? 'draft' : 'withdrawn'
  if (row.id !== id || row.status !== status || row.version !== command.expectedVersion) throw new ExamApiError('exam_unavailable', 503)
  return { id, version: uuid(row.version), status, updatedAt: date(row.updatedAt) }
}
