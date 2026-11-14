// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadExamSourceMap, selectExamSourceGroups, type ExamSourceMap } from '../../../scripts/lib/exams/sourceMap'

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T

// All identities, hashes, pages and group boundaries are synthetic test data.
function syntheticMap(): Mutable<ExamSourceMap> {
  return {
    schemaVersion: 1,
    sources: [{
      id: 'synthetic-a', title: 'Synthetic source A, not a real PDF extraction', sha256: 'a'.repeat(64), pageCount: 6, coverage: 'partial',
      pages: [
        { id: 'question', reference: { sourceId: 'synthetic-a', pdfPage: 1, printedPage: 'A-1', role: 'exam' }, kind: 'question', review: 'source_checked' },
        { id: 'answer', reference: { sourceId: 'synthetic-a', pdfPage: 2, printedPage: 'A-2', role: 'solution' }, kind: 'answer', review: 'pending' },
        { id: 'script', reference: { sourceId: 'synthetic-a', pdfPage: 3, printedPage: 'A-3', role: 'teacher_notes' }, kind: 'script', review: 'pending' },
        { id: 'toc', reference: { sourceId: 'synthetic-a', pdfPage: 4, printedPage: null, role: 'guidance' }, kind: 'toc', review: 'source_checked' },
        { id: 'training', reference: { sourceId: 'synthetic-a', pdfPage: 5, printedPage: 'A-5', role: 'training' }, kind: 'question', review: 'pending' },
        { id: 'other-test', reference: { sourceId: 'synthetic-a', pdfPage: 6, printedPage: 'A-6', role: 'exam' }, kind: 'question', review: 'pending' },
      ],
      groups: [
        { id: 'exam-group', testNumber: 1, role: 'exam', sectionId: 'reading_writing', partNumber: 1, pageIds: ['question', 'answer', 'script'] },
        { id: 'second-exam-group', testNumber: 1, role: 'exam', sectionId: 'reading_writing', partNumber: 1, pageIds: ['question', 'answer'] },
        { id: 'training-group', testNumber: 1, role: 'training', sectionId: 'reading_writing', partNumber: 1, pageIds: ['training', 'script'] },
        { id: 'other-test-group', testNumber: 2, role: 'exam', sectionId: 'reading_writing', partNumber: 1, pageIds: ['other-test', 'answer'] },
      ],
    }, {
      id: 'synthetic-b', title: 'Synthetic source B, independently paginated', sha256: 'b'.repeat(64), pageCount: 1, coverage: 'partial',
      pages: [{ id: 'question', reference: { sourceId: 'synthetic-b', pdfPage: 1, printedPage: 'B-10', role: 'exam' }, kind: 'question', review: 'pending' }],
      groups: [{ id: 'exam-group', testNumber: 1, role: 'exam', sectionId: 'reading_writing', partNumber: 1, pageIds: ['question'] }],
    }],
  }
}

describe('exam source maps and complete-group selection', () => {
  let directory: string
  let mapPath: string
  let map: Mutable<ExamSourceMap>
  const writeMap = (value: unknown = map): Promise<void> => writeFile(mapPath, JSON.stringify(value), 'utf8')

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'rosie-exams-source-map-'))
    mapPath = path.join(directory, 'synthetic-map.json')
    map = syntheticMap()
    await writeMap()
  })
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })

  it('loads synthetic source identities and preserves whole groups including private pages', async () => {
    const loaded = await loadExamSourceMap(mapPath)
    const selected = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 1, role: 'exam' })
    expect(selected.source.id).toBe('synthetic-a')
    expect(selected.groups.map(group => group.id).sort()).toEqual(['exam-group', 'second-exam-group'])
    expect(selected.pages.map(page => page.id).sort()).toEqual(['answer', 'question', 'script'])
    expect(selected.pages.map(page => page.reference.role)).toEqual(expect.arrayContaining(['exam', 'solution', 'teacher_notes']))
    expect(selected.pages.some(page => page.id === 'toc')).toBe(false)
    expect(selected.mapHash).toMatch(/^[a-f0-9]{64}$/)
    expect(selected.selectionHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('selects source, test and role together without inferring a universal printed-page offset', async () => {
    const loaded = await loadExamSourceMap(mapPath)
    const training = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 1, role: 'training' })
    expect(training.groups.map(group => group.id)).toEqual(['training-group'])
    expect(training.pages.map(page => page.id).sort()).toEqual(['script', 'training'])
    const otherTest = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 2, role: 'exam' })
    expect(otherTest.pages.map(page => page.id).sort()).toEqual(['answer', 'other-test'])
    const sourceA = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 1, role: 'exam' })
    const sourceB = selectExamSourceGroups(loaded, { sourceId: 'synthetic-b', testNumber: 1, role: 'exam' })
    expect(sourceA.pages.find(page => page.reference.pdfPage === 1)?.reference.printedPage).toBe('A-1')
    expect(sourceB.pages[0].reference.printedPage).toBe('B-10')
    expect(sourceA.selectionHash).not.toBe(sourceB.selectionHash)
  })

  it('does not mutate the map while deduplicating shared page references', async () => {
    const loaded = await loadExamSourceMap(mapPath)
    const before = JSON.stringify(loaded)
    const first = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 1, role: 'exam' })
    const second = selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 1, role: 'exam' })
    expect(JSON.stringify(loaded)).toBe(before)
    expect(first.pages.filter(page => page.id === 'answer')).toHaveLength(1)
    expect(second.selectionHash).toBe(first.selectionHash)
    expect(second.mapHash).toBe(first.mapHash)
  })

  it('rejects missing sources and empty selections', async () => {
    const loaded = await loadExamSourceMap(mapPath)
    expect(() => selectExamSourceGroups(loaded, { sourceId: 'missing', testNumber: 1, role: 'exam' })).toThrow()
    expect(() => selectExamSourceGroups(loaded, { sourceId: 'synthetic-a', testNumber: 99, role: 'exam' })).toThrow()
  })

  it('rejects duplicate source, page and group identities in their own scopes', async () => {
    map.sources.push(structuredClone(map.sources[0]))
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    map.sources[0].pages.push(structuredClone(map.sources[0].pages[0]))
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    map.sources[0].groups.push(structuredClone(map.sources[0].groups[0]))
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects missing or duplicated group page IDs instead of silently dropping members', async () => {
    map.sources[0].groups[0].pageIds.push('missing-page')
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    map.sources[0].groups[0].pageIds.push('question')
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects references from another edition and inconsistent printed labels on one PDF page', async () => {
    map.sources[0].pages[0].reference.sourceId = 'synthetic-b'
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    map.sources[0].pages.push({ id: 'conflicting-label', reference: { sourceId: 'synthetic-a', pdfPage: 1, printedPage: 'unexpected-label', role: 'guidance' }, kind: 'explanation', review: 'pending' })
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects out-of-range pages and normalized crops that escape the page', async () => {
    map.sources[0].pages[0].reference.pdfPage = 7
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map.sources[0].pages[0].reference.pdfPage = 0
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    map.sources[0].pages[0].reference.region = { x: 0.9, y: 0, width: 0.2, height: 1 }
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('requires lowercase source hashes, a supported schema and exact object fields', async () => {
    map.sources[0].sha256 = 'A'.repeat(64)
    await writeMap()
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    map = syntheticMap()
    await writeMap({ ...map, schemaVersion: 2 })
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    await writeMap({ ...map, inputPdf: '/not-a-mapped-input.pdf' })
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    await writeMap({ ...map, sources: [{ ...map.sources[0], coverage: 'complete' }] })
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('keeps transcription checks distinct from approval and rejects malformed JSON', async () => {
    await writeMap({ ...map, sources: [{ ...map.sources[0], pages: [{ ...map.sources[0].pages[0], review: 'approved' }] }] })
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
    await writeFile(mapPath, '{unfinished', 'utf8')
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects mapping files above the bounded JSON size limit', async () => {
    await writeFile(mapPath, ' '.repeat(2 * 1024 * 1024 + 1), 'utf8')
    await expect(loadExamSourceMap(mapPath)).rejects.toMatchObject({ code: 'exam_invalid_source_map', exitCode: 2 })
  })
})
