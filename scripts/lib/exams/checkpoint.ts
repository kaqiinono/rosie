import { constants } from 'node:fs'
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { ExamImportError } from './bundle'

const MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/

export interface ExamDraftReceipt {
  id: string
  contentSetId: string
  revision: number
  version: string
  status: 'draft'
  createdAt: string
  updatedAt: string
}

export interface PendingExamRequest {
  method: 'POST' | 'PATCH'
  requestId: string
  expectedVersion: string | null
  body: string
  createdAt: string
}

export interface ExamImportCheckpoint {
  schemaVersion: 1
  origin: string
  contentRevisionId: string
  bundleHash: string
  draftHash: string
  pending: PendingExamRequest | null
  receipt: ExamDraftReceipt | null
}

export interface ExamCheckpointStore {
  read(): Promise<ExamImportCheckpoint | null>
  write(state: ExamImportCheckpoint): Promise<void>
  release(): Promise<void>
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value))
}

/** Project only the receipt contract; response extras never enter the journal. */
export function parseExamDraftReceipt(value: unknown): ExamDraftReceipt | null {
  if (!record(value) || typeof value.id !== 'string' || !ID.test(value.id)
    || typeof value.contentSetId !== 'string' || !ID.test(value.contentSetId)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 1
    || typeof value.version !== 'string' || !UUID.test(value.version) || value.status !== 'draft'
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) return null
  return {
    id: value.id, contentSetId: value.contentSetId, revision: value.revision,
    version: value.version, status: 'draft', createdAt: value.createdAt, updatedAt: value.updatedAt,
  }
}

function decodeCheckpoint(value: unknown, origin: string, id: string): ExamImportCheckpoint {
  const invalid = () => new ExamImportError('exam_checkpoint_invalid', 1)
  if (!record(value) || value.schemaVersion !== 1 || value.origin !== origin || value.contentRevisionId !== id
    || typeof value.bundleHash !== 'string' || !HASH.test(value.bundleHash)
    || typeof value.draftHash !== 'string' || !HASH.test(value.draftHash)) throw invalid()
  const receipt = value.receipt === null ? null : parseExamDraftReceipt(value.receipt)
  if (value.receipt !== null && (!receipt || receipt.id !== id)) throw invalid()
  let pending: PendingExamRequest | null = null
  if (value.pending !== null) {
    const request = value.pending
    if (!record(request) || (request.method !== 'POST' && request.method !== 'PATCH')
      || typeof request.requestId !== 'string' || !UUID.test(request.requestId)
      || typeof request.body !== 'string' || Buffer.byteLength(request.body, 'utf8') > 2 * 1024 * 1024
      || !timestamp(request.createdAt)
      || (request.method === 'POST' && (request.expectedVersion !== null || receipt !== null))
      || (request.method === 'PATCH' && (typeof request.expectedVersion !== 'string'
        || !UUID.test(request.expectedVersion) || !receipt || request.expectedVersion !== receipt.version))) throw invalid()
    pending = {
      method: request.method, requestId: request.requestId,
      expectedVersion: request.expectedVersion as string | null, body: request.body, createdAt: request.createdAt,
    }
  }
  if (!pending && !receipt) throw invalid()
  return {
    schemaVersion: 1, origin, contentRevisionId: id,
    bundleHash: value.bundleHash, draftHash: value.draftHash, pending, receipt,
  }
}

function isCode(error: unknown, code: string): boolean {
  return record(error) && error.code === code
}

export function checkpointKey(origin: string, contentRevisionId: string): string {
  return createHash('sha256').update(JSON.stringify([origin, contentRevisionId])).digest('hex')
}

/** The lock is intentionally never stolen, including after a crashed process. */
export async function openCheckpoint(stateDirectory: string, origin: string, id: string): Promise<ExamCheckpointStore> {
  let directory: string
  try {
    await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
    const stat = await lstat(stateDirectory)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ExamImportError('exam_checkpoint_invalid', 1)
    await chmod(stateDirectory, 0o700)
    directory = await realpath(stateDirectory)
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    throw new ExamImportError('exam_checkpoint_io', 1)
  }

  const key = checkpointKey(origin, id)
  const statePath = join(directory, `${key}.json`)
  const lockPath = join(directory, `${key}.lock`)
  let lock: Awaited<ReturnType<typeof open>>
  try {
    lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  } catch (error) {
    throw new ExamImportError(isCode(error, 'EEXIST') ? 'exam_import_locked' : 'exam_checkpoint_io', 1)
  }
  let released = false
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }), 'utf8')
    await lock.sync()
  } catch {
    await lock.close().catch(() => undefined)
    await unlink(lockPath).catch(() => undefined)
    throw new ExamImportError('exam_checkpoint_io', 1)
  }

  return {
    async read() {
      if (released) throw new ExamImportError('exam_checkpoint_io', 1)
      let handle: Awaited<ReturnType<typeof open>> | undefined
      try {
        handle = await open(statePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
        const stat = await handle.stat()
        if (!stat.isFile() || stat.size > MAX_CHECKPOINT_BYTES) throw new ExamImportError('exam_checkpoint_invalid', 1)
        await handle.chmod(0o600)
        const buffer = Buffer.alloc(MAX_CHECKPOINT_BYTES + 1)
        let length = 0
        while (length < buffer.length) {
          const result = await handle.read(buffer, length, buffer.length - length, null)
          if (!result.bytesRead) break
          length += result.bytesRead
        }
        if (length > MAX_CHECKPOINT_BYTES) throw new ExamImportError('exam_checkpoint_invalid', 1)
        let text: string
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)) }
        catch { throw new ExamImportError('exam_checkpoint_invalid', 1) }
        let value: unknown
        try { value = JSON.parse(text) as unknown } catch { throw new ExamImportError('exam_checkpoint_invalid', 1) }
        return decodeCheckpoint(value, origin, id)
      } catch (error) {
        if (isCode(error, 'ENOENT')) return null
        if (error instanceof ExamImportError) throw error
        throw new ExamImportError('exam_checkpoint_io', 1)
      } finally {
        await handle?.close()
      }
    },
    async write(state) {
      if (released) throw new ExamImportError('exam_checkpoint_io', 1)
      const payload = JSON.stringify(decodeCheckpoint(state, origin, id))
      if (Buffer.byteLength(payload, 'utf8') > MAX_CHECKPOINT_BYTES) throw new ExamImportError('exam_checkpoint_invalid', 1)
      const temporary = join(directory, `${key}.${randomUUID()}.tmp`)
      let handle: Awaited<ReturnType<typeof open>> | undefined
      try {
        handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
        await handle.writeFile(payload, 'utf8')
        await handle.sync()
        await handle.close()
        handle = undefined
        await rename(temporary, statePath)
        const directoryHandle = await open(directory, constants.O_RDONLY)
        try { await directoryHandle.sync() } finally { await directoryHandle.close() }
      } catch {
        throw new ExamImportError('exam_checkpoint_io', 1)
      } finally {
        await handle?.close()
        await unlink(temporary).catch(() => undefined)
      }
    },
    async release() {
      if (released) return
      released = true
      try {
        const held = await lock.stat()
        const current = await lstat(lockPath)
        await lock.close()
        if (held.ino !== current.ino || held.dev !== current.dev) throw new ExamImportError('exam_checkpoint_io', 1)
        await unlink(lockPath)
      } catch {
        await lock.close().catch(() => undefined)
        throw new ExamImportError('exam_checkpoint_io', 1)
      }
    },
  }
}
