import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamRecording } from '@rosie/exams'
import { ExamApiError, examIdentifier, readExamJsonBody } from './http'
import { attemptUuid } from './attempts'

const BUCKET = 'exam-recordings'
const MAX_BYTES = 20 * 1024 * 1024
const MIME_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
interface RecordingRow {
  id: string; user_id: string; attempt_id: string; question_id: string; object_path: string
  mime_type: string; size_bytes: number; sha256: string; status: ExamRecording['status']
  created_at: string; completed_at: string | null
}

export function assessmentStorageError(error: { message?: string }): never {
  const codes: Record<string, number> = { exam_not_found: 404, exam_conflict: 409, exam_expired: 409,
    exam_invalid_request: 400, exam_recording_closed: 409, exam_recording_limit: 409,
    exam_recording_incomplete: 409, exam_invalid_grade: 400, exam_invalid_transition: 409 }
  if (error.message && Object.hasOwn(codes, error.message)) throw new ExamApiError(error.message, codes[error.message])
  throw new ExamApiError('exam_unavailable', 503)
}

export async function assessmentBody(request: Request, allowed: readonly string[]): Promise<Record<string, unknown>> {
  const value = await readExamJsonBody(request)
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) throw new ExamApiError('exam_invalid_request', 400)
  return value as Record<string, unknown>
}

function receipt(row: RecordingRow): ExamRecording {
  return { id: row.id, attemptId: row.attempt_id, questionId: row.question_id, mimeType: row.mime_type,
    sizeBytes: row.size_bytes, status: row.status, createdAt: row.created_at, completedAt: row.completed_at }
}

function rpcReceipt(data: unknown, attemptId: string): ExamRecording {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
  const value = data as Record<string, unknown>
  if (value.attemptId !== attemptId || typeof value.id !== 'string' || typeof value.questionId !== 'string'
    || typeof value.mimeType !== 'string' || !MIME_TYPES.includes(value.mimeType)
    || typeof value.sizeBytes !== 'number' || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || value.sizeBytes > MAX_BYTES
    || !['uploading', 'complete', 'abandoned'].includes(String(value.status)) || typeof value.createdAt !== 'string'
    || (value.completedAt !== null && typeof value.completedAt !== 'string')) throw new ExamApiError('exam_unavailable', 503)
  return { id: value.id, attemptId, questionId: value.questionId, mimeType: value.mimeType, sizeBytes: value.sizeBytes,
    status: value.status as ExamRecording['status'], createdAt: value.createdAt, completedAt: value.completedAt as string | null }
}

async function recordingRow(db: SupabaseClient, userId: string, attemptId: string, recordingId: string): Promise<RecordingRow> {
  const { data, error } = await db.from('exam_recordings')
    .select('id,user_id,attempt_id,question_id,object_path,mime_type,size_bytes,sha256,status,created_at,completed_at')
    .eq('id', recordingId).eq('user_id', userId).eq('attempt_id', attemptId).maybeSingle()
  if (error) assessmentStorageError(error)
  if (!data) throw new ExamApiError('exam_not_found', 404)
  const row = data as RecordingRow
  // Paths are server-derived; refuse an unexpected row rather than proxy any object.
  if (row.object_path !== `${userId}/${attemptId}/${recordingId}` || !MIME_TYPES.includes(row.mime_type)
    || !Number.isSafeInteger(row.size_bytes) || row.size_bytes <= 0 || row.size_bytes > MAX_BYTES
    || !/^[0-9a-f]{64}$/.test(row.sha256)) throw new ExamApiError('exam_unavailable', 503)
  return row
}

export async function listExamRecordings(db: SupabaseClient, userId: string, attemptId: string): Promise<ExamRecording[]> {
  const attempt = await db.from('exam_attempts').select('id').eq('id', attemptId).eq('user_id', userId).maybeSingle()
  if (attempt.error) assessmentStorageError(attempt.error)
  if (!attempt.data) throw new ExamApiError('exam_not_found', 404)
  const { data, error } = await db.from('exam_recordings')
    .select('id,attempt_id,question_id,mime_type,size_bytes,status,created_at,completed_at')
    .eq('user_id', userId).eq('attempt_id', attemptId).order('created_at', { ascending: true }).limit(40)
  if (error) assessmentStorageError(error)
  return (data ?? []).map(row => receipt(row as RecordingRow))
}

export async function prepareExamRecording(db: SupabaseClient, userId: string, attemptId: string, request: Request): Promise<ExamRecording> {
  const body = await assessmentBody(request, ['requestId', 'expectedVersion', 'questionId', 'mimeType', 'sizeBytes', 'sha256'])
  if (typeof body.mimeType !== 'string' || !MIME_TYPES.includes(body.mimeType)
    || typeof body.sizeBytes !== 'number' || !Number.isSafeInteger(body.sizeBytes) || body.sizeBytes <= 0 || body.sizeBytes > MAX_BYTES
    || typeof body.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(body.sha256)) throw new ExamApiError('exam_invalid_recording', 400)
  const { data, error } = await db.rpc('prepare_exam_recording', { p_user: userId, p_attempt_id: attemptId,
    p_expected_version: attemptUuid(body.expectedVersion), p_request_id: attemptUuid(body.requestId),
    p_question_id: examIdentifier(body.questionId), p_mime_type: body.mimeType, p_size_bytes: body.sizeBytes, p_sha256: body.sha256 })
  if (error) assessmentStorageError(error)
  return rpcReceipt(data, attemptId)
}

async function readRecordingBytes(request: Request, row: RecordingRow): Promise<Buffer> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== row.mime_type) throw new ExamApiError('exam_recording_type_mismatch', 415)
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) !== row.size_bytes)) throw new ExamApiError('exam_recording_size_mismatch', 400)
  if (!request.body) throw new ExamApiError('exam_recording_empty', 400)
  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined) }, 60_000)
  try {
    while (true) {
      const result = await reader.read()
      if (timedOut) throw new ExamApiError('exam_recording_upload_timeout', 408)
      if (result.done) break
      size += result.value.byteLength
      if (size > row.size_bytes || size > MAX_BYTES) { await reader.cancel(); throw new ExamApiError('exam_payload_too_large', 413) }
      chunks.push(Buffer.from(result.value))
    }
  } catch (error) {
    if (error instanceof ExamApiError) throw error
    throw new ExamApiError('exam_recording_upload_interrupted', 400)
  } finally { clearTimeout(timeout); reader.releaseLock() }
  const bytes = Buffer.concat(chunks, size)
  if (size !== row.size_bytes) throw new ExamApiError('exam_recording_size_mismatch', 400)
  if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new ExamApiError('exam_recording_hash_mismatch', 400)
  const header = bytes.subarray(0, 12)
  const valid = row.mime_type === 'audio/webm' ? header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : row.mime_type === 'audio/ogg' ? header.subarray(0, 4).toString() === 'OggS'
    : row.mime_type === 'audio/mp4' ? header.subarray(4, 8).toString() === 'ftyp'
    : row.mime_type === 'audio/wav' ? header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WAVE'
    : header.subarray(0, 3).toString() === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  if (!valid) throw new ExamApiError('exam_recording_type_mismatch', 415)
  return bytes
}

async function storedRecordingBytes(db: SupabaseClient, row: RecordingRow): Promise<Blob> {
  const result = await db.storage.from(BUCKET).download(row.object_path)
  if (result.error || !result.data) throw new ExamApiError('exam_recording_unavailable', 503)
  if (result.data.size !== row.size_bytes) throw new ExamApiError('exam_recording_hash_mismatch', 409)
  const bytes = await result.data.arrayBuffer()
  if (createHash('sha256').update(Buffer.from(bytes)).digest('hex') !== row.sha256) throw new ExamApiError('exam_recording_hash_mismatch', 409)
  return result.data
}

export async function uploadExamRecording(db: SupabaseClient, userId: string, attemptId: string, recordingId: string, request: Request): Promise<ExamRecording> {
  const row = await recordingRow(db, userId, attemptId, recordingId)
  if (row.status === 'abandoned') throw new ExamApiError('exam_recording_closed', 409)
  const bytes = await readRecordingBytes(request, row)
  if (row.status === 'complete') return receipt(row)
  // Never upsert: a lost response retries the same immutable object and verifies
  // its bytes before finalization. Concurrent abandon leaves only a private orphan.
  const stored = await db.storage.from(BUCKET).upload(row.object_path, bytes, { contentType: row.mime_type, upsert: false, cacheControl: '0' })
  if (stored.error) await storedRecordingBytes(db, row)
  const { data, error } = await db.rpc('finish_exam_recording', { p_user: userId, p_attempt_id: attemptId, p_recording_id: recordingId, p_status: 'complete', p_request_id: null })
  if (error) assessmentStorageError(error)
  return rpcReceipt(data, attemptId)
}

export async function abandonExamRecording(db: SupabaseClient, userId: string, attemptId: string, recordingId: string, request: Request): Promise<ExamRecording> {
  const body = await assessmentBody(request, ['requestId'])
  const requestId = attemptUuid(body.requestId)
  const { data, error } = await db.rpc('finish_exam_recording', { p_user: userId, p_attempt_id: attemptId, p_recording_id: recordingId, p_status: 'abandoned', p_request_id: requestId })
  if (error) assessmentStorageError(error)
  return rpcReceipt(data, attemptId)
}

export async function playExamRecording(db: SupabaseClient, userId: string, attemptId: string, recordingId: string): Promise<Response> {
  const row = await recordingRow(db, userId, attemptId, recordingId)
  if (row.status !== 'complete') throw new ExamApiError('exam_recording_incomplete', 409)
  const blob = await storedRecordingBytes(db, row)
  return new Response(blob, { headers: { 'Content-Type': row.mime_type, 'Content-Length': String(row.size_bytes),
    'Cache-Control': 'private, no-store', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' } })
}
