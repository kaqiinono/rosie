import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, realpath, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SourceReference } from '../../../packages/exams/src/types/content'
import {
  describeExamDraftReadiness, validateExamDraft,
  type ExamDraftInput, type ValidationIssue,
} from '../../../packages/exams/src/validation'

export const MAX_EXAM_REQUEST_BYTES = 2 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const ROLES = ['exam', 'training', 'guidance', 'teacher_notes', 'solution']

export interface ExamBundleManifest {
  schemaVersion: 1
  sourceId: string
  sourceSha256: string
  extractionVersion: string
  contentSetId: string
  contentRevisionId: string
  revision: number
}

export interface LoadedExamBundle {
  draft: ExamDraftInput
  manifest: ExamBundleManifest
  sourcePages: readonly SourceReference[]
  bundleHash: string
  draftHash: string
  readiness: ReturnType<typeof describeExamDraftReadiness>
}

/** Messages are fixed codes; never put input values, answers or credentials here. */
export class ExamImportError extends Error {
  constructor(
    readonly code: string,
    readonly exitCode: 1 | 2 | 3,
    readonly issues?: readonly ValidationIssue[],
  ) {
    super(code)
    this.name = 'ExamImportError'
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

/** Object order is immaterial; arrays, including complete answer tuples, retain order. */
export function stableJson(value: unknown): string {
  const ancestors = new WeakSet<object>()
  const encode = (item: unknown, depth: number): string => {
    if (depth > 32) throw new ExamImportError('exam_invalid_json', 2)
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item)
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item)
    if (typeof item !== 'object' || ancestors.has(item)) throw new ExamImportError('exam_invalid_json', 2)
    ancestors.add(item)
    let encoded: string
    if (Array.isArray(item)) {
      encoded = `[${Array.from(item, entry => encode(entry, depth + 1)).join(',')}]`
    } else {
      const prototype: unknown = Object.getPrototypeOf(item)
      if (prototype !== Object.prototype && prototype !== null) throw new ExamImportError('exam_invalid_json', 2)
      const descriptors = Object.getOwnPropertyDescriptors(item)
      const keys = Reflect.ownKeys(item)
      if (keys.some(key => typeof key !== 'string')) throw new ExamImportError('exam_invalid_json', 2)
      encoded = `{${(keys as string[]).sort().map(key => {
        if (!Object.hasOwn(descriptors[key], 'value')) throw new ExamImportError('exam_invalid_json', 2)
        const child: unknown = descriptors[key].value
        return `${JSON.stringify(key)}:${encode(child, depth + 1)}`
      }).join(',')}}`
    }
    ancestors.delete(item)
    return encoded
  }
  return encode(value, 0)
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export function draftDigest(draft: ExamDraftInput): string {
  return digest(draft)
}

export function encodeSaveBody(draft: ExamDraftInput, requestId: string, expectedVersion?: string): string {
  if (!UUID.test(requestId) || (expectedVersion !== undefined && !UUID.test(expectedVersion))) {
    throw new ExamImportError('exam_invalid_request_identity', 2)
  }
  const text = stableJson(expectedVersion === undefined
    ? { draft, requestId }
    : { draft, requestId, expectedVersion })
  if (Buffer.byteLength(text, 'utf8') > MAX_EXAM_REQUEST_BYTES) throw new ExamImportError('exam_payload_too_large', 2)
  return text
}

async function readBundleFile(root: string, name: string): Promise<unknown> {
  const path = join(root, name)
  try {
    // Fixed direct children only; reject even an inward symlink, avoiding target swaps.
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const info = await handle.stat()
      if (!info.isFile() || dirname(await realpath(path)) !== root) throw new ExamImportError('exam_invalid_bundle_path', 2)
      if (info.size > MAX_EXAM_REQUEST_BYTES) throw new ExamImportError('exam_bundle_file_too_large', 2)
      const buffer = Buffer.alloc(MAX_EXAM_REQUEST_BYTES + 1)
      let length = 0
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null)
        if (!bytesRead) break
        length += bytesRead
      }
      if (length > MAX_EXAM_REQUEST_BYTES) throw new ExamImportError('exam_bundle_file_too_large', 2)
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length))
        return JSON.parse(text) as unknown
      } catch {
        throw new ExamImportError('exam_invalid_json', 2)
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    const code = record(error) ? error.code : undefined
    if (code === 'ELOOP') throw new ExamImportError('exam_invalid_bundle_path', 2)
    if (code === 'ENOENT' || code === 'ENOTDIR') throw new ExamImportError('exam_bundle_file_missing', 2)
    throw new ExamImportError('exam_bundle_read_failed', 1)
  }
}

function parseManifest(value: unknown, draft: ExamDraftInput): ExamBundleManifest {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'sourceId', 'sourceSha256', 'extractionVersion', 'contentSetId', 'contentRevisionId', 'revision']) ||
      value.schemaVersion !== 1 || typeof value.sourceSha256 !== 'string' || !HASH.test(value.sourceSha256) ||
      typeof value.extractionVersion !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(value.extractionVersion)) {
    throw new ExamImportError('exam_invalid_manifest', 2)
  }
  if (value.sourceId !== draft.contentSet.source.id || value.sourceSha256 !== draft.contentSet.source.fileHash ||
      value.contentSetId !== draft.contentSet.id || value.contentRevisionId !== draft.content.id || value.revision !== draft.content.revision) {
    throw new ExamImportError('exam_manifest_mismatch', 2)
  }
  return value as unknown as ExamBundleManifest
}

function parseSourcePages(value: unknown, sourceId: string): SourceReference[] {
  if (!Array.isArray(value) || value.length > 2_000) throw new ExamImportError('exam_invalid_source_pages', 2)
  const seen = new Set<string>()
  const printedPages = new Map<number, string | null>()
  return value.map((entry: unknown) => {
    if (!record(entry) || !exactKeys(entry, ['sourceId', 'pdfPage', 'printedPage', 'role'], ['region']) ||
        entry.sourceId !== sourceId || typeof entry.pdfPage !== 'number' || !Number.isSafeInteger(entry.pdfPage) || entry.pdfPage < 1 || entry.pdfPage > 1_000_000_000 ||
        (entry.printedPage !== null && (typeof entry.printedPage !== 'string' || !entry.printedPage.trim() || entry.printedPage.length > 50_000)) ||
        typeof entry.role !== 'string' || !ROLES.includes(entry.role)) {
      throw new ExamImportError('exam_invalid_source_pages', 2)
    }
    if (Object.hasOwn(entry, 'region')) {
      const region = entry.region
      if (!record(region) || !exactKeys(region, ['x', 'y', 'width', 'height']) ||
          !Object.values(region).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) {
        throw new ExamImportError('exam_invalid_source_pages', 2)
      }
      const { x, y, width, height } = region as Record<'x' | 'y' | 'width' | 'height', number>
      if (width <= 0 || height <= 0 || x + width > 1 + 1e-9 || y + height > 1 + 1e-9) throw new ExamImportError('exam_invalid_source_pages', 2)
    }
    const reference = entry as unknown as SourceReference
    const key = stableJson(reference)
    if (seen.has(key)) throw new ExamImportError('exam_duplicate_source_page', 2)
    seen.add(key)
    if (printedPages.has(reference.pdfPage) && printedPages.get(reference.pdfPage) !== reference.printedPage) {
      throw new ExamImportError('exam_source_page_conflict', 2)
    }
    printedPages.set(reference.pdfPage, reference.printedPage)
    return reference
  })
}

function sourceReferences(value: unknown): SourceReference[] {
  // Called only after the strict draft schema. pdfPage occurs only on SourceReference.
  if (Array.isArray(value)) return value.flatMap(sourceReferences)
  if (!record(value)) return []
  if (Object.hasOwn(value, 'pdfPage')) return [value as unknown as SourceReference]
  return Object.values(value).flatMap(sourceReferences)
}

export async function loadExamBundle(directory: string): Promise<LoadedExamBundle> {
  let root: string
  try {
    root = await realpath(directory)
    if (!(await stat(root)).isDirectory()) throw new ExamImportError('exam_invalid_bundle_path', 2)
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    if (record(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) throw new ExamImportError('exam_bundle_file_missing', 2)
    throw new ExamImportError('exam_bundle_read_failed', 1)
  }
  const manifestInput = await readBundleFile(root, 'manifest.json')
  const draftInput = {
    contentSet: await readBundleFile(root, 'content-set.json'),
    content: await readBundleFile(root, 'content.json'),
    solutions: await readBundleFile(root, 'solutions.private.json'),
  }
  const result = validateExamDraft(draftInput)
  if (!result.ok) throw new ExamImportError('exam_invalid_draft', 2, result.issues)
  const draft = result.value
  const manifest = parseManifest(manifestInput, draft)
  const sourcePages = parseSourcePages(await readBundleFile(root, 'source-pages.json'), manifest.sourceId)
  const pageKeys = new Set(sourcePages.map(stableJson))
  if (sourceReferences(draft).some(reference => !pageKeys.has(stableJson(reference)))) {
    throw new ExamImportError('exam_source_reference_missing', 2)
  }
  const privatePages = new Set(sourcePages.filter(page => page.role === 'solution' || page.role === 'teacher_notes').map(page => page.pdfPage))
  if (sourceReferences(draft.content).some(reference => privatePages.has(reference.pdfPage) && !reference.region)) {
    throw new ExamImportError('exam_mixed_role_crop_required', 2)
  }
  // Reserve the full PATCH envelope, so a valid bundle remains saveable on later updates.
  encodeSaveBody(draft, '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000')
  return {
    draft, manifest, sourcePages, draftHash: draftDigest(draft),
    bundleHash: digest({ manifest, draft, sourcePages }),
    readiness: describeExamDraftReadiness(draft),
  }
}
