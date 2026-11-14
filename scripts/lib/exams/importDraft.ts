import { randomUUID } from 'node:crypto'
import { validateExamDraft } from '../../../packages/exams/src/validation'
import { draftDigest, encodeSaveBody, ExamImportError, stableJson, type LoadedExamBundle } from './bundle'
import { openCheckpoint, parseExamDraftReceipt, type ExamDraftReceipt, type ExamImportCheckpoint, type PendingExamRequest } from './checkpoint'

// Admin reads wrap a valid 2 MiB draft with readiness, version and timestamps.
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REMOTE_ERRORS = new Set([
  'unauthorized', 'forbidden', 'exam_invalid_draft', 'exam_invalid_vocabulary_reference',
  'exam_not_found', 'exam_conflict', 'exam_not_editable', 'exam_revision_mismatch',
  'exam_invalid_id', 'exam_invalid_request', 'exam_invalid_request_id', 'exam_invalid_version',
  'exam_json_required', 'exam_payload_too_large', 'exam_invalid_json', 'exam_unavailable',
])

export interface ImportOptions {
  baseUrl: string
  accessToken: string
  stateDirectory: string
  resume?: boolean
  updateExisting?: boolean
  fetch?: typeof globalThis.fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => number
}

export interface ImportResult {
  status: 'created' | 'updated' | 'unchanged'
  receipt: ExamDraftReceipt
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function originFor(value: string): string {
  try {
    const url = new URL(value)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (value !== value.trim() || !/^https?:\/\/[^/?#@]+\/?$/.test(value)
      || url.username || url.password || url.pathname !== '/'
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) throw new Error()
    return url.origin
  } catch {
    throw new ExamImportError('exam_invalid_base_url', 2)
  }
}

function retryDelay(response: Response | undefined, attempt: number, now: () => number): number {
  const fallback = (attempt + 1) * 1000
  const value = response?.headers.get('retry-after')
  if (!value) return fallback
  const requested = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now()
  return Number.isFinite(requested) ? Math.max(fallback, Math.min(30_000, Math.max(0, requested))) : fallback
}

async function responseJson(response: Response): Promise<unknown> {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    || !response.body) {
    await response.body?.cancel().catch(() => undefined)
    throw new ExamImportError('exam_invalid_response', 3)
  }
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    await response.body.cancel().catch(() => undefined)
    throw new ExamImportError('exam_invalid_response', 3)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_RESPONSE_BYTES) throw new ExamImportError('exam_invalid_response', 3)
      try { text += decoder.decode(chunk.value, { stream: true }) }
      catch { throw new ExamImportError('exam_invalid_response', 3) }
    }
    try { return JSON.parse(text + decoder.decode()) as unknown }
    catch { throw new ExamImportError('exam_invalid_response', 3) }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    if (error instanceof ExamImportError) throw error
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function requestJson(
  url: string, method: 'GET' | 'POST' | 'PATCH', body: string | undefined, options: ImportOptions,
): Promise<unknown> {
  const fetcher = options.fetch ?? globalThis.fetch
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds)))
  const now = options.now ?? Date.now
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    let response: Response | undefined
    try {
      response = await fetcher(url, {
        method, redirect: 'manual', signal: controller.signal,
        headers: {
          Authorization: `Bearer ${options.accessToken}`, Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body }),
      })
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined)
        throw new ExamImportError('exam_redirect_rejected', 3)
      }
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel().catch(() => undefined)
        if (attempt === 2) throw new ExamImportError(response.status === 429 ? 'exam_rate_limited' : 'exam_unavailable', 3)
      } else {
        const value = await responseJson(response)
        if (!response.ok) {
          const code = record(value) && typeof value.error === 'string' && REMOTE_ERRORS.has(value.error)
            ? value.error : response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden'
              : response.status === 404 ? 'exam_not_found' : response.status === 409 ? 'exam_conflict' : 'exam_http_error'
          throw new ExamImportError(code, 3)
        }
        if ((method === 'POST' && response.status !== 201) || (method !== 'POST' && response.status !== 200)) {
          throw new ExamImportError('exam_invalid_response', 3)
        }
        return value
      }
    } catch (error) {
      if (error instanceof ExamImportError) throw error
      // Fetch/stream transport errors never contribute their message to output.
      if (attempt === 2) throw new ExamImportError('exam_unavailable', 3)
    } finally {
      clearTimeout(timer)
    }
    await sleep(retryDelay(response, attempt, now))
  }
  throw new ExamImportError('exam_unavailable', 3)
}

function matchReceipt(value: unknown, bundle: LoadedExamBundle): ExamDraftReceipt {
  const receipt = parseExamDraftReceipt(value)
  if (!receipt || receipt.id !== bundle.manifest.contentRevisionId
    || receipt.contentSetId !== bundle.manifest.contentSetId || receipt.revision !== bundle.manifest.revision) {
    throw new ExamImportError('exam_invalid_response', 3)
  }
  return receipt
}

function validatePending(state: ExamImportCheckpoint, bundle: LoadedExamBundle): PendingExamRequest {
  const pending = state.pending
  if (!pending) throw new ExamImportError('exam_resume_missing', 2)
  if (state.bundleHash !== bundle.bundleHash || state.draftHash !== bundle.draftHash) {
    throw new ExamImportError('exam_bundle_changed', 2)
  }
  // Reconstruct for integrity comparison only; replay the stored bytes below.
  const expected = encodeSaveBody(bundle.draft, pending.requestId, pending.expectedVersion ?? undefined)
  let stored: unknown
  try { stored = JSON.parse(pending.body) as unknown } catch { throw new ExamImportError('exam_checkpoint_invalid', 1) }
  let intended: unknown
  try { intended = JSON.parse(expected) as unknown } catch { throw new ExamImportError('exam_checkpoint_invalid', 1) }
  if (stableJson(stored) !== stableJson(intended)) throw new ExamImportError('exam_checkpoint_invalid', 1)
  return pending
}

/** Only this CLI's acknowledged version can authorize an explicit draft update. */
export async function importExamDraft(bundle: LoadedExamBundle, options: ImportOptions): Promise<ImportResult> {
  const origin = originFor(options.baseUrl)
  if (!options.accessToken || options.accessToken !== options.accessToken.trim() || /\s/.test(options.accessToken)) {
    throw new ExamImportError('exam_invalid_access_token', 2)
  }
  if (!options.stateDirectory || (options.resume && options.updateExisting)) {
    throw new ExamImportError('exam_invalid_options', 2)
  }
  if (draftDigest(bundle.draft) !== bundle.draftHash) throw new ExamImportError('exam_bundle_changed', 2)
  const id = bundle.manifest.contentRevisionId
  const detailUrl = `${origin}/api/admin/exams/${encodeURIComponent(id)}`
  const store = await openCheckpoint(options.stateDirectory, origin, id)
  try {
    let state = await store.read()
    let pending: PendingExamRequest
    if (state?.pending) {
      pending = validatePending(state, bundle)
      if (!options.resume) throw new ExamImportError('exam_resume_required', 2)
    } else {
      if (options.resume && !state) throw new ExamImportError('exam_resume_missing', 2)
      if (state) {
        const prior = state.receipt
        if (!prior) throw new ExamImportError('exam_checkpoint_invalid', 1)
        const current = await requestJson(detailUrl, 'GET', undefined, options)
        if (!record(current) || typeof current.version !== 'string' || !UUID.test(current.version)) {
          throw new ExamImportError('exam_invalid_response', 3)
        }
        const validation = validateExamDraft(current.draft)
        if (!validation.ok || validation.value.content.id !== id
          || validation.value.contentSet.id !== prior.contentSetId
          || validation.value.content.revision !== prior.revision) throw new ExamImportError('exam_invalid_response', 3)
        if (current.version !== prior.version) throw new ExamImportError('exam_version_changed', 3)
        // A matching token with different stored content is not adopted either.
        if (draftDigest(validation.value) !== state.draftHash) throw new ExamImportError('exam_version_changed', 3)
        if (state.bundleHash === bundle.bundleHash && state.draftHash === bundle.draftHash) {
          return { status: 'unchanged', receipt: prior }
        }
        if (options.resume) throw new ExamImportError('exam_bundle_changed', 2)
        if (!options.updateExisting) throw new ExamImportError('exam_update_required', 2)
        if (prior.contentSetId !== bundle.manifest.contentSetId || prior.revision !== bundle.manifest.revision) {
          throw new ExamImportError('exam_bundle_changed', 2)
        }
      } else if (options.updateExisting) {
        throw new ExamImportError('exam_update_unowned', 2)
      }
      const requestId = randomUUID()
      const expectedVersion = state?.receipt?.version ?? null
      pending = {
        method: expectedVersion === null ? 'POST' : 'PATCH', requestId, expectedVersion,
        body: encodeSaveBody(bundle.draft, requestId, expectedVersion ?? undefined),
        createdAt: new Date((options.now ?? Date.now)()).toISOString(),
      }
      state = {
        schemaVersion: 1, origin, contentRevisionId: id, bundleHash: bundle.bundleHash,
        draftHash: bundle.draftHash, pending, receipt: state?.receipt ?? null,
      }
      await store.write(state)
    }
    const value = await requestJson(pending.method === 'POST' ? `${origin}/api/admin/exams` : detailUrl,
      pending.method, pending.body, options)
    const receipt = matchReceipt(value, bundle)
    if (pending.expectedVersion === receipt.version) throw new ExamImportError('exam_invalid_response', 3)
    await store.write({ ...state, pending: null, receipt })
    return { status: pending.method === 'POST' ? 'created' : 'updated', receipt }
  } finally {
    await store.release()
  }
}
