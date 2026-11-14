// @vitest-environment node

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeExamDraftReadiness, type ExamDraftInput } from '../../../packages/exams/src/validation'
import { draftDigest, stableJson, type LoadedExamBundle } from '../../../scripts/lib/exams/bundle'
import { checkpointKey, openCheckpoint, type ExamDraftReceipt, type ExamImportCheckpoint } from '../../../scripts/lib/exams/checkpoint'
import { importExamDraft, type ImportOptions } from '../../../scripts/lib/exams/importDraft'

const ORIGIN = 'https://rosie.test'
const TOKEN = 'synthetic-admin-token-never-persist'
const VERSION_ONE = '11111111-1111-4111-8111-111111111111'
const VERSION_TWO = '22222222-2222-4222-8222-222222222222'
const NOW = Date.parse('2026-11-13T00:00:00Z')

// This empty authoring draft is synthetic; its hash is test data, not an extracted PDF hash.
function syntheticBundle(title = 'Synthetic draft', extractionVersion = 'synthetic-v1'): LoadedExamBundle {
  const draft: ExamDraftInput = {
    contentSet: {
      id: 'synthetic:test-1', source: { id: 'synthetic', title: 'Synthetic source; no PDF extraction', fileHash: 'a'.repeat(64) },
      testNumber: 1, title, kind: 'training_unit', template: { id: 'ket-schools-2020-v1', version: 1 }, purpose: 'training',
    },
    content: {
      schemaVersion: 1, id: 'synthetic:test-1:revision-1', contentSetId: 'synthetic:test-1', revision: 1, status: 'draft',
      materials: [], groups: [], guidance: [], vocabularyLinks: [], mediaSlots: [], mediaBindingRevisionId: null,
      readiness: { exam: { status: 'pending' }, explanations: { status: 'pending' } },
    },
    solutions: { schemaVersion: 1, contentRevisionId: 'synthetic:test-1:revision-1', solutions: [], teacherNotes: [], mediaSlots: [] },
  }
  const manifest: LoadedExamBundle['manifest'] = {
    schemaVersion: 1, sourceId: 'synthetic', sourceSha256: 'a'.repeat(64), extractionVersion,
    contentSetId: draft.contentSet.id, contentRevisionId: draft.content.id, revision: 1,
  }
  const sourcePages: LoadedExamBundle['sourcePages'] = []
  return {
    draft, manifest, sourcePages, draftHash: draftDigest(draft),
    bundleHash: createHash('sha256').update(stableJson({ manifest, draft, sourcePages })).digest('hex'),
    readiness: describeExamDraftReadiness(draft),
  }
}

function receipt(bundle: LoadedExamBundle, version = VERSION_ONE): ExamDraftReceipt {
  return { id: bundle.draft.content.id, contentSetId: bundle.draft.contentSet.id, revision: bundle.draft.content.revision, version, status: 'draft', createdAt: '2026-11-13T00:00:00Z', updatedAt: '2026-11-13T00:00:00Z' }
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function remoteRecord(bundle: LoadedExamBundle, version = VERSION_ONE) {
  return { draft: bundle.draft, version, createdAt: '2026-11-13T00:00:00Z', updatedAt: '2026-11-13T00:00:00Z' }
}

describe('recoverable administrator exam draft imports', () => {
  let root: string
  let stateDirectory: string
  let bundle: LoadedExamBundle
  const fetcher = vi.fn<typeof globalThis.fetch>()
  const sleep = vi.fn<(milliseconds: number) => Promise<void>>()

  const options = (overrides: Partial<ImportOptions> = {}): ImportOptions => ({ baseUrl: ORIGIN, accessToken: TOKEN, stateDirectory, fetch: fetcher, sleep, now: () => NOW, ...overrides })
  const statePath = (): string => path.join(stateDirectory, `${checkpointKey(ORIGIN, bundle.draft.content.id)}.json`)
  const readState = async (): Promise<ExamImportCheckpoint> => JSON.parse(await readFile(statePath(), 'utf8')) as ExamImportCheckpoint
  const create = async (): Promise<void> => {
    fetcher.mockResolvedValueOnce(response(receipt(bundle), 201))
    await importExamDraft(bundle, options())
    fetcher.mockReset()
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'rosie-exams-import-'))
    stateDirectory = path.join(root, 'import-state')
    bundle = syntheticBundle()
    fetcher.mockReset()
    sleep.mockReset().mockResolvedValue(undefined)
  })
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  it('persists a private pending request before POST, then projects the receipt without storing the token', async () => {
    fetcher.mockImplementation(async (url, init) => {
      const pending = await readState()
      expect(String(url)).toBe(`${ORIGIN}/api/admin/exams`)
      expect(init?.method).toBe('POST')
      expect(init?.redirect).toBe('manual')
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
      expect(pending.pending?.body).toBe(init?.body)
      expect(pending.pending?.method).toBe('POST')
      expect(pending.pending?.expectedVersion).toBeNull()
      expect(pending.pending?.createdAt).toBe('2026-11-13T00:00:00.000Z')
      expect(pending.receipt).toBeNull()
      expect((await stat(statePath())).mode & 0o777).toBe(0o600)
      return response({ ...receipt(bundle), unexpectedSecret: TOKEN }, 201)
    })
    expect(await importExamDraft(bundle, options())).toEqual({ status: 'created', receipt: receipt(bundle) })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const state = await readState()
    expect(state.pending).toBeNull()
    expect(state.receipt).toEqual(receipt(bundle))
    expect(await readFile(statePath(), 'utf8')).not.toContain(TOKEN)
  })

  it('replays identical POST bytes after a committed response is lost, including automatic retries', async () => {
    const committed = new Map<string, ExamDraftReceipt>()
    const bodies: string[] = []
    fetcher.mockImplementation(async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected serialized request')
      bodies.push(init.body)
      const command = JSON.parse(init.body) as { requestId: string }
      if (!committed.has(command.requestId)) committed.set(command.requestId, receipt(bundle))
      throw new TypeError('Synthetic response loss after server commit')
    })
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_unavailable', exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [2000]])
    const pending = (await readState()).pending
    expect(pending).not.toBeNull()
    expect(new Set(bodies).size).toBe(1)
    fetcher.mockImplementation(async (_url, init) => {
      expect(init?.body).toBe(pending?.body)
      expect(init?.method).toBe('POST')
      const command = JSON.parse(String(init?.body)) as { requestId: string }
      return response(committed.get(command.requestId), 201)
    })
    expect((await importExamDraft(bundle, options({ resume: true }))).status).toBe('created')
    expect(committed.size).toBe(1)
    expect((await readState()).pending).toBeNull()
  })

  it('requires explicit resume for a pending request and refuses changed content or source metadata', async () => {
    fetcher.mockRejectedValue(new TypeError('Synthetic transport failure'))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_unavailable' })
    fetcher.mockReset()
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_resume_required', exitCode: 2 })
    await expect(importExamDraft(syntheticBundle('Changed synthetic draft'), options({ resume: true }))).rejects.toMatchObject({ code: 'exam_bundle_changed', exitCode: 2 })
    const changedMetadata = syntheticBundle('Synthetic draft', 'synthetic-v2')
    expect(changedMetadata.draftHash).toBe(bundle.draftHash)
    await expect(importExamDraft(changedMetadata, options({ resume: true }))).rejects.toMatchObject({ code: 'exam_bundle_changed', exitCode: 2 })
    const changedPages = syntheticBundle()
    changedPages.sourcePages = [{ sourceId: 'synthetic', pdfPage: 2, printedPage: 'S-2', role: 'guidance' }]
    changedPages.bundleHash = createHash('sha256').update(stableJson({ manifest: changedPages.manifest, draft: changedPages.draft, sourcePages: changedPages.sourcePages })).digest('hex')
    await expect(importExamDraft(changedPages, options({ resume: true }))).rejects.toMatchObject({ code: 'exam_bundle_changed', exitCode: 2 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('confirms an acknowledged unchanged draft with GET and never rewrites it', async () => {
    await create()
    fetcher.mockResolvedValueOnce(response(remoteRecord(bundle)))
    expect(await importExamDraft(bundle, options())).toEqual({ status: 'unchanged', receipt: receipt(bundle) })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(`${ORIGIN}/api/admin/exams/${encodeURIComponent(bundle.draft.content.id)}`)
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET')
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('retains the original PATCH version and bytes across lost responses and a later resume', async () => {
    await create()
    const changed = syntheticBundle('Explicitly updated synthetic draft')
    const patchBodies: string[] = []
    fetcher.mockImplementation(async (_url, init) => {
      if (init?.method === 'GET') return response(remoteRecord(bundle))
      expect(init?.method).toBe('PATCH')
      if (typeof init?.body !== 'string') throw new Error('Expected serialized patch')
      patchBodies.push(init.body)
      const state = await readState()
      expect(state.pending?.body).toBe(init.body)
      expect(state.pending?.expectedVersion).toBe(VERSION_ONE)
      throw new TypeError('Synthetic response loss after patch commit')
    })
    await expect(importExamDraft(changed, options({ updateExisting: true }))).rejects.toMatchObject({ code: 'exam_unavailable' })
    expect(patchBodies).toHaveLength(3)
    expect(new Set(patchBodies).size).toBe(1)
    const pending = (await readState()).pending
    expect(pending?.method).toBe('PATCH')
    expect(pending?.expectedVersion).toBe(VERSION_ONE)
    fetcher.mockReset().mockImplementation(async (_url, init) => {
      expect(init?.method).toBe('PATCH')
      expect(init?.body).toBe(pending?.body)
      expect(JSON.parse(String(init?.body))).toMatchObject({ expectedVersion: VERSION_ONE, requestId: pending?.requestId })
      return response(receipt(changed, VERSION_TWO))
    })
    expect((await importExamDraft(changed, options({ resume: true }))).status).toBe('updated')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((await readState()).receipt?.version).toBe(VERSION_TWO)
  })

  it('requires explicit updates and never adopts a remote version observed after another editor saves', async () => {
    await create()
    const changed = syntheticBundle('Updated synthetic draft')
    fetcher.mockResolvedValueOnce(response(remoteRecord(bundle)))
    await expect(importExamDraft(changed, options())).rejects.toMatchObject({ code: 'exam_update_required', exitCode: 2 })
    expect(fetcher.mock.calls.every(call => call[1]?.method === 'GET')).toBe(true)
    fetcher.mockReset().mockResolvedValueOnce(response(remoteRecord(bundle, VERSION_TWO)))
    await expect(importExamDraft(changed, options({ updateExisting: true }))).rejects.toMatchObject({ code: 'exam_version_changed', exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((await readState()).receipt?.version).toBe(VERSION_ONE)
  })

  it('stops a racing PATCH at 409 without fetching a replacement version or rebuilding its request', async () => {
    await create()
    const changed = syntheticBundle('Synthetic racing edit')
    fetcher.mockResolvedValueOnce(response(remoteRecord(bundle))).mockResolvedValueOnce(response({ error: 'exam_conflict' }, 409))
    await expect(importExamDraft(changed, options({ updateExisting: true }))).rejects.toMatchObject({ code: 'exam_conflict', exitCode: 3 })
    expect(fetcher.mock.calls.map(call => call[1]?.method)).toEqual(['GET', 'PATCH'])
    expect(sleep).not.toHaveBeenCalled()
    expect((await readState()).pending?.expectedVersion).toBe(VERSION_ONE)
  })

  it('stops when the recorded draft disappears rather than recreating it', async () => {
    await create()
    fetcher.mockResolvedValueOnce(response({ error: 'exam_not_found' }, 404))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_not_found', exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET')
    expect((await readState()).pending).toBeNull()
  })

  it('does not claim an existing remote ID without a successful local receipt', async () => {
    await expect(importExamDraft(bundle, options({ updateExisting: true }))).rejects.toMatchObject({ code: 'exam_update_unowned', exitCode: 2 })
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockResolvedValueOnce(response({ error: 'exam_conflict' }, 409))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_conflict', exitCode: 3 })
    expect(fetcher.mock.calls.map(call => call[1]?.method)).toEqual(['POST'])
  })

  it('rejects resume without a checkpoint and leaves conflicting locks for manual handling', async () => {
    await expect(importExamDraft(bundle, options({ resume: true }))).rejects.toMatchObject({ code: 'exam_resume_missing', exitCode: 2 })
    const held = await openCheckpoint(stateDirectory, ORIGIN, bundle.draft.content.id)
    try {
      await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_import_locked', exitCode: 1 })
    } finally {
      await held.release()
    }
    const lockPath = path.join(stateDirectory, `${checkpointKey(ORIGIN, bundle.draft.content.id)}.lock`)
    await writeFile(lockPath, JSON.stringify({ pid: 999999 }), { mode: 0o600 })
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_import_locked', exitCode: 1 })
    expect(await readFile(lockPath, 'utf8')).toBe(JSON.stringify({ pid: 999999 }))
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('binds the checkpoint key and document to the API origin and revision', async () => {
    expect(checkpointKey(ORIGIN, bundle.draft.content.id)).toMatch(/^[a-f0-9]{64}$/)
    expect(checkpointKey(ORIGIN, bundle.draft.content.id)).not.toBe(checkpointKey('http://127.0.0.1:3000', bundle.draft.content.id))
    await create()
    const state = await readState()
    await writeFile(statePath(), JSON.stringify({ ...state, origin: 'http://127.0.0.1:3000' }))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_checkpoint_invalid', exitCode: 1 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('bounds 429 retries to three requests with 1/2 second fallback delays', async () => {
    fetcher.mockImplementation(async () => response({ error: 'synthetic_rate_limit' }, 429))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_rate_limited', exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [2000]])
    expect((await readState()).pending).not.toBeNull()
  })

  it('caps Retry-After and recovers from transient server failures without changing request bytes', async () => {
    fetcher.mockResolvedValueOnce(response({ error: 'synthetic_rate_limit' }, 429, { 'Retry-After': '999999' }))
      .mockResolvedValueOnce(new Response('Synthetic upstream unavailable', { status: 503 }))
      .mockResolvedValueOnce(response(receipt(bundle), 201))
    expect((await importExamDraft(bundle, options())).status).toBe('created')
    expect(sleep.mock.calls).toEqual([[30000], [2000]])
    expect(new Set(fetcher.mock.calls.map(call => call[1]?.body)).size).toBe(1)
  })

  it('retries a response stream interrupted after headers using the same request body', async () => {
    const interrupted = new ReadableStream<Uint8Array>({
      start(controller) { controller.error(new Error('Synthetic response stream disconnected')) },
    })
    fetcher.mockResolvedValueOnce(new Response(interrupted, { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(response(receipt(bundle), 201))
    expect((await importExamDraft(bundle, options())).status).toBe('created')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body)
    expect(sleep.mock.calls).toEqual([[1000]])
  })

  it.each([
    [401, 'unauthorized'], [403, 'forbidden'], [422, 'exam_invalid_vocabulary_reference'], [409, 'exam_not_editable'],
  ] as const)('stops HTTP %i immediately and preserves pending state', async (status, code) => {
    fetcher.mockResolvedValueOnce(response({ error: code, privateDetails: TOKEN }, status))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code, exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    expect((await readState()).pending).not.toBeNull()
    expect(await readFile(statePath(), 'utf8')).not.toContain(TOKEN)
  })

  it('rejects redirects without following or forwarding credentials to the target', async () => {
    fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1:4000' } }))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_redirect_rejected', exitCode: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][1]?.redirect).toBe('manual')
    expect(String(fetcher.mock.calls[0][0])).toBe(`${ORIGIN}/api/admin/exams`)
  })

  it('rejects non-JSON responses without including private text or tokens in errors', async () => {
    const privateMarker = 'synthetic-private-answer-marker'
    fetcher.mockResolvedValueOnce(new Response(`<html>${TOKEN} ${privateMarker}</html>`, { status: 201, headers: { 'Content-Type': 'text/html' } }))
    const error: unknown = await importExamDraft(bundle, options()).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'exam_invalid_response', exitCode: 3 })
    expect(String(error)).not.toContain(TOKEN)
    expect(String(error)).not.toContain(privateMarker)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('accepts a synthetic response envelope above 2 MiB but below 4 MiB and discards extra fields', async () => {
    // Synthetic response-only padding models server metadata beyond the saved request.
    const payload = { ...receipt(bundle), syntheticEnvelopePadding: 'x'.repeat(2 * 1024 * 1024) }
    const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8')
    expect(bytes).toBeGreaterThan(2 * 1024 * 1024)
    expect(bytes).toBeLessThan(4 * 1024 * 1024)
    fetcher.mockResolvedValueOnce(response(payload, 201))
    expect(await importExamDraft(bundle, options())).toEqual({ status: 'created', receipt: receipt(bundle) })
    const state = await readState()
    expect(state.pending).toBeNull()
    expect(state.receipt).toEqual(receipt(bundle))
    expect(await readFile(statePath(), 'utf8')).not.toContain('syntheticEnvelopePadding')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects a synthetic response envelope above 4 MiB while preserving the pending request', async () => {
    // Synthetic response boundary fixture; no extracted content or real HTTP is involved.
    const payload = { ...receipt(bundle), syntheticEnvelopePadding: 'x'.repeat(4 * 1024 * 1024) }
    expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeGreaterThan(4 * 1024 * 1024)
    fetcher.mockResolvedValueOnce(response(payload, 201))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_invalid_response', exitCode: 3 })
    const state = await readState()
    expect(state.pending).not.toBeNull()
    expect(state.receipt).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it.each([
    'http://rosie.test', 'https://user:secret@rosie.test',
    `${ORIGIN}/nested`, `${ORIGIN}?token=secret`, `${ORIGIN}#fragment`,
  ])('rejects unsafe API origins before network or state writes: %s', async (baseUrl) => {
    await expect(importExamDraft(bundle, options({ baseUrl }))).rejects.toMatchObject({ code: 'exam_invalid_base_url', exitCode: 2 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a modified pending body instead of transmitting tampered data', async () => {
    fetcher.mockRejectedValue(new TypeError('Synthetic transport failure'))
    await expect(importExamDraft(bundle, options())).rejects.toMatchObject({ code: 'exam_unavailable' })
    const state = await readState()
    if (!state.pending) throw new Error('Expected synthetic pending request')
    await mkdir(stateDirectory, { recursive: true })
    await writeFile(statePath(), JSON.stringify({ ...state, pending: { ...state.pending, body: '{}' } }))
    fetcher.mockReset()
    await expect(importExamDraft(bundle, options({ resume: true }))).rejects.toMatchObject({ code: 'exam_checkpoint_invalid', exitCode: 1 })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
