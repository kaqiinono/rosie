import 'server-only'

import { NextResponse } from 'next/server'
import { isAdminRequestUser, lookupUserFromRequest } from '@/lib/api-auth'
import { validateExamDraft, type ExamDraftInput, type ValidationIssue } from '@rosie/exams/validation'

const MAX_BODY_BYTES = 2 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/

export interface ExamPageRequest {
  page: number
  pageSize: number
}

export interface ExamSaveCommand {
  draft: ExamDraftInput
  requestId: string
  expectedVersion: string | null
}

export class ExamApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly issues?: readonly ValidationIssue[],
  ) {
    super(code)
    this.name = 'ExamApiError'
  }
}

export function examJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' },
  })
}

export function examFailure(error: unknown) {
  if (error instanceof ExamApiError) {
    return examJson({ error: error.code, ...(error.issues ? { issues: error.issues } : {}) }, error.status)
  }
  // Never expose SQL, credentials, raw input or solution data through an error message.
  return examJson({ error: 'exam_unavailable' }, 503)
}

export async function authorizeExamRequest(request: Request, admin = false) {
  const { user, unreachable, reason } = await lookupUserFromRequest(request)
  if (unreachable) throw new ExamApiError(`auth_${reason ?? 'unavailable'}`, 503)
  if (!user) throw new ExamApiError('unauthorized', 401)
  if (admin && !isAdminRequestUser(user)) throw new ExamApiError('forbidden', 403)
  return user
}

export function examIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    throw new ExamApiError('exam_invalid_id', 400)
  }
  return value
}

export function examPageRequest(request: Request): ExamPageRequest {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some((key) => !['page', 'pageSize'].includes(key))) {
    throw new ExamApiError('exam_invalid_pagination', 400)
  }
  const read = (key: string, fallback: number, maximum: number) => {
    const values = params.getAll(key)
    if (!values.length) return fallback
    if (values.length !== 1 || !/^[1-9][0-9]*$/.test(values[0])) {
      throw new ExamApiError('exam_invalid_pagination', 400)
    }
    const value = Number(values[0])
    if (!Number.isSafeInteger(value) || value > maximum) {
      throw new ExamApiError('exam_invalid_pagination', 400)
    }
    return value
  }
  return { page: read('page', 1, 10000), pageSize: read('pageSize', 25, 100) }
}

export async function readExamJsonBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ExamApiError('exam_json_required', 415)
  }
  const length = request.headers.get('content-length')
  if (length && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw new ExamApiError('exam_payload_too_large', 413)
  }
  if (!request.body) throw new ExamApiError('exam_invalid_json', 400)
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new ExamApiError('exam_payload_too_large', 413)
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    if (error instanceof ExamApiError) throw error
    throw new ExamApiError('exam_invalid_json', 400)
  } finally {
    reader.releaseLock()
  }
}

export async function readExamSaveCommand(request: Request, update: boolean): Promise<ExamSaveCommand> {
  const value = await readExamJsonBody(request)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExamApiError('exam_invalid_request', 400)
  }
  const body = value as Record<string, unknown>
  const allowed = update ? ['draft', 'requestId', 'expectedVersion'] : ['draft', 'requestId']
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ExamApiError('exam_invalid_request', 400)
  }
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
    throw new ExamApiError('exam_invalid_request_id', 400)
  }
  const expectedVersion = update ? body.expectedVersion : null
  if (update && (typeof expectedVersion !== 'string' || !UUID.test(expectedVersion))) {
    throw new ExamApiError('exam_invalid_version', 400)
  }
  const result = validateExamDraft(body.draft)
  if (!result.ok) throw new ExamApiError('exam_invalid_draft', 400, result.issues)
  examIdentifier(result.value.content.id)
  examIdentifier(result.value.contentSet.id)
  return { draft: result.value, requestId: body.requestId, expectedVersion: expectedVersion as string | null }
}
