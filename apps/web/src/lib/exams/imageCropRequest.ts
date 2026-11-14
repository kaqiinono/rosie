import 'server-only'
import type { ExamImageCropCommand } from '@rosie/exams'
import { ExamApiError, examIdentifier } from './http'

export const MAX_CROP_BYTES = 4 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const invalid = (): never => { throw new ExamApiError('exam_invalid_image_crop', 400) }

export async function readImageCropRequest(request: Request) {
  if (request.headers.get('content-type') !== 'image/png') throw new ExamApiError('exam_image_png_required', 415)
  let value: unknown
  try { value = JSON.parse(request.headers.get('x-exam-crop') ?? '') } catch { invalid() }
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const c = value as Record<string, unknown>
  if (Object.keys(c).some(key => !['requestId', 'revisionId', 'slotId', 'expectedVersion', 'expectedBindingRevisionId', 'sourceSha256', 'region'].includes(key))) invalid()
  for (const key of ['requestId', 'expectedVersion']) if (typeof c[key] !== 'string' || !UUID.test(c[key])) invalid()
  if (c.expectedBindingRevisionId !== null && (typeof c.expectedBindingRevisionId !== 'string' || !UUID.test(c.expectedBindingRevisionId))) invalid()
  examIdentifier(c.revisionId); examIdentifier(c.slotId)
  if (typeof c.sourceSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(c.sourceSha256)) invalid()
  if (!c.region || typeof c.region !== 'object' || Array.isArray(c.region)) invalid()
  const r = c.region as Record<string, unknown>
  if (Object.keys(r).length !== 4 || ['x', 'y', 'width', 'height'].some(key => typeof r[key] !== 'number' || !Number.isFinite(r[key]))) invalid()
  const region = r as ExamImageCropCommand['region']
  if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 || region.x + region.width > 1.000001 || region.y + region.height > 1.000001) invalid()
  const length = Number(request.headers.get('content-length'))
  if (length > MAX_CROP_BYTES) throw new ExamApiError('exam_image_too_large', 413)
  const body = request.body
  if (body === null) throw new ExamApiError('exam_invalid_image_crop', 400)
  const chunks: Uint8Array[] = []; let size = 0
  const reader = body.getReader()
  try {
    while (true) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      size += chunk.byteLength
      if (size > MAX_CROP_BYTES) { await reader.cancel(); throw new ExamApiError('exam_image_too_large', 413) }
      chunks.push(chunk)
    }
  } finally { reader.releaseLock() }
  const bytes = Buffer.concat(chunks)
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16) !== 'IHDR') invalid()
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
  if (width < 8 || height < 8 || width > 16000 || height > 16000 || width * height > 40_000_000) invalid()
  return { command: c as unknown as ExamImageCropCommand, bytes, width, height }
}
