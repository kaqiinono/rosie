import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import type { QuestionRole, SourceReference } from '../../../packages/exams/src/types/content'
import { ExamImportError, stableJson } from './bundle'

const LIMIT = 2 * 1024 * 1024
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/
const ROLES = ['exam', 'training', 'guidance', 'teacher_notes', 'solution']
const KINDS = ['toc', 'question', 'answer', 'explanation', 'transcript', 'script', 'picture']

export interface ExamSourcePage {
  id: string
  reference: SourceReference
  kind: 'toc' | 'question' | 'answer' | 'explanation' | 'transcript' | 'script' | 'picture'
  review: 'pending' | 'source_checked'
}

export interface ExamSourceGroup {
  id: string
  testNumber: number
  role: QuestionRole
  sectionId: string
  partNumber: number
  pageIds: readonly string[]
}

export interface ExamMappedSource {
  id: string
  title: string
  sha256: string
  pageCount: number
  coverage: 'partial'
  pages: readonly ExamSourcePage[]
  groups: readonly ExamSourceGroup[]
}

export interface ExamSourceMap {
  schemaVersion: 1
  sources: readonly ExamMappedSource[]
}

export interface SelectedSourceGroups {
  source: ExamMappedSource
  groups: readonly ExamSourceGroup[]
  pages: readonly ExamSourcePage[]
  mapHash: string
  selectionHash: string
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

function id(value: unknown): value is string { return typeof value === 'string' && ID.test(value) }
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 }
function invalid(): never { throw new ExamImportError('exam_invalid_source_map', 2) }

function reference(value: unknown, sourceId: string, pageCount: number): SourceReference {
  if (!record(value) || !keys(value, ['sourceId', 'pdfPage', 'printedPage', 'role'], ['region'])
    || value.sourceId !== sourceId || !integer(value.pdfPage) || value.pdfPage > pageCount
    || (value.printedPage !== null && (typeof value.printedPage !== 'string' || !value.printedPage.trim() || value.printedPage.length > 1000))
    || typeof value.role !== 'string' || !ROLES.includes(value.role)) invalid()
  if (Object.hasOwn(value, 'region')) {
    const region = value.region
    if (!record(region) || !keys(region, ['x', 'y', 'width', 'height'])
      || !Object.values(region).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) invalid()
    const { x, y, width, height } = region as Record<'x' | 'y' | 'width' | 'height', number>
    if (width <= 0 || height <= 0 || x + width > 1 + 1e-9 || y + height > 1 + 1e-9) invalid()
  }
  return value as unknown as SourceReference
}

function parseMap(value: unknown): ExamSourceMap {
  if (!record(value) || !keys(value, ['schemaVersion', 'sources']) || value.schemaVersion !== 1
    || !Array.isArray(value.sources) || !value.sources.length || value.sources.length > 100) invalid()
  const sourceIds = new Set<string>()
  for (const entry of value.sources as unknown[]) {
    if (!record(entry) || !keys(entry, ['id', 'title', 'sha256', 'pageCount', 'coverage', 'pages', 'groups'])
      || !id(entry.id) || sourceIds.has(entry.id) || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 1000
      || typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256) || !integer(entry.pageCount)
      || entry.coverage !== 'partial' || !Array.isArray(entry.pages) || entry.pages.length > 10_000
      || !Array.isArray(entry.groups) || entry.groups.length > 10_000) invalid()
    sourceIds.add(entry.id)
    const pageIds = new Set<string>()
    const printed = new Map<number, string | null>()
    for (const page of entry.pages as unknown[]) {
      if (!record(page) || !keys(page, ['id', 'reference', 'kind', 'review']) || !id(page.id) || pageIds.has(page.id)
        || typeof page.kind !== 'string' || !KINDS.includes(page.kind)
        || (page.review !== 'pending' && page.review !== 'source_checked')) invalid()
      pageIds.add(page.id)
      const ref = reference(page.reference, entry.id, entry.pageCount)
      if (printed.has(ref.pdfPage) && printed.get(ref.pdfPage) !== ref.printedPage) invalid()
      printed.set(ref.pdfPage, ref.printedPage)
    }
    const groupIds = new Set<string>()
    for (const group of entry.groups as unknown[]) {
      if (!record(group) || !keys(group, ['id', 'testNumber', 'role', 'sectionId', 'partNumber', 'pageIds'])
        || !id(group.id) || groupIds.has(group.id) || !integer(group.testNumber) || !integer(group.partNumber)
        || !id(group.sectionId) || (group.role !== 'exam' && group.role !== 'training')
        || !Array.isArray(group.pageIds) || !group.pageIds.length || group.pageIds.length > 10_000
        || group.pageIds.some((pageId: unknown) => typeof pageId !== 'string' || !pageIds.has(pageId))
        || new Set(group.pageIds).size !== group.pageIds.length) invalid()
      groupIds.add(group.id)
    }
  }
  return value as unknown as ExamSourceMap
}

export async function loadExamSourceMap(path: string): Promise<ExamSourceMap> {
  try {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size > LIMIT) invalid()
      const buffer = Buffer.alloc(LIMIT + 1)
      let length = 0
      while (length < buffer.length) {
        const chunk = await handle.read(buffer, length, buffer.length - length, null)
        if (!chunk.bytesRead) break
        length += chunk.bytesRead
      }
      if (length > LIMIT) invalid()
      let value: unknown
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length))) as unknown }
      catch { invalid() }
      return parseMap(value)
    } finally { await handle.close() }
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    throw new ExamImportError('exam_source_map_read_failed', 1)
  }
}

export function selectExamSourceGroups(map: ExamSourceMap, options: { sourceId: string; testNumber: number; role: QuestionRole }): SelectedSourceGroups {
  parseMap(map)
  if (!id(options.sourceId) || !integer(options.testNumber) || (options.role !== 'exam' && options.role !== 'training')) {
    throw new ExamImportError('exam_invalid_source_selection', 2)
  }
  const source = map.sources.find(entry => entry.id === options.sourceId)
  if (!source) throw new ExamImportError('exam_source_not_found', 2)
  const groups = source.groups.filter(group => group.testNumber === options.testNumber && group.role === options.role)
  if (!groups.length) throw new ExamImportError('exam_source_groups_missing', 2)
  // Select complete groups first; private answer/script pages remain attached.
  const pageIds = new Set(groups.flatMap(group => [...group.pageIds]))
  const pages = source.pages.filter(page => pageIds.has(page.id))
  const hash = (value: unknown) => createHash('sha256').update(stableJson(value)).digest('hex')
  return { source, groups, pages, mapHash: hash(map), selectionHash: hash({ sourceId: source.id, groups, pages }) }
}
