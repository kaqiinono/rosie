// @vitest-environment node

import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  draftDigest, encodeSaveBody, ExamImportError, loadExamBundle, stableJson,
} from '../../../scripts/lib/exams/bundle'
import type { ExamDraftInput } from '../../../packages/exams/src/validation'
import type { SourceReference } from '../../../packages/exams/src/types/content'

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T

// Entirely synthetic test data. The hash and page labels below do not identify a real PDF.
function syntheticFiles() {
  const publicPage: SourceReference = { sourceId: 'synthetic', pdfPage: 1, printedPage: 'S-1', role: 'training' }
  const privatePage: SourceReference = { sourceId: 'synthetic', pdfPage: 3, printedPage: 'S-3', role: 'solution' }
  const sourceHash = 'a'.repeat(64)
  const publicProvenance = { origin: 'source' as const, sources: [publicPage], review: { status: 'pending' as const } }
  const privateProvenance = { origin: 'source' as const, sources: [privatePage], review: { status: 'pending' as const } }
  const questionId = 'synthetic:test-1:training:reading_writing:part-5:1' as const
  const draft: Mutable<ExamDraftInput> = {
    contentSet: {
      id: 'synthetic:test-1', source: { id: 'synthetic', title: 'Synthetic fixture, not PDF extraction', fileHash: sourceHash },
      testNumber: 1, title: 'Synthetic training set', kind: 'training_unit',
      template: { id: 'ket-schools-2020-v1', version: 1 }, purpose: 'training',
    },
    content: {
      schemaVersion: 1, id: 'synthetic:test-1:revision-1', contentSetId: 'synthetic:test-1', revision: 1, status: 'draft',
      materials: [{ id: 'material', familyId: 'synthetic-family', role: 'training', title: 'Synthetic material', blocks: [{ id: 'text', kind: 'text', text: 'Synthetic alpha and beta.' }], provenance: publicProvenance }],
      groups: [{
        id: 'group', role: 'training', sectionId: 'reading_writing', partNumber: 5,
        instructions: [], materialIds: ['material'], optionPools: [], provenance: publicProvenance,
        questions: [{
          id: questionId, location: { sourceId: 'synthetic', testNumber: 1, role: 'training', sectionId: 'reading_writing', partNumber: 5, questionNumber: '1' },
          answerType: 'gap_fill', prompt: [], gaps: [{ id: 'first', label: 'First synthetic gap', maxWords: 1 }, { id: 'second', label: 'Second synthetic gap', maxWords: 1 }],
          answerOrder: 'fixed', scoring: { kind: 'objective', maxPoints: 1 }, provenance: publicProvenance,
          classification: { domain: 'reading', questionTypeId: 'open_cloze', primarySkillId: 'synthetic_skill', knowledgePointIds: [], topicIds: [], review: { status: 'pending' } },
        }],
      }],
      guidance: [], vocabularyLinks: [], mediaSlots: [], mediaBindingRevisionId: null,
      readiness: { exam: { status: 'pending' }, explanations: { status: 'pending' } },
    },
    solutions: {
      schemaVersion: 1, contentRevisionId: 'synthetic:test-1:revision-1', teacherNotes: [], mediaSlots: [],
      solutions: [{
        id: 'synthetic-solution', role: 'solution', questionId, answerType: 'gap_fill', provenance: privateProvenance,
        explanations: [{ text: 'Synthetic explanation only.', provenance: privateProvenance }],
        evidence: [{ source: publicPage, quote: 'Synthetic alpha and beta.', materialId: 'material', blockId: 'text' }], distractors: [],
        acceptedAnswerSets: [[{ gapId: 'first', value: 'alpha' }, { gapId: 'second', value: 'beta' }], [{ gapId: 'first', value: 'gamma' }, { gapId: 'second', value: 'delta' }]],
        normalization: { trim: true, ignoreCase: true },
      }],
    },
  }
  return {
    draft,
    manifest: { schemaVersion: 1, sourceId: 'synthetic', sourceSha256: sourceHash, extractionVersion: 'synthetic-fixture-v1', contentSetId: draft.contentSet.id, contentRevisionId: draft.content.id, revision: 1 },
    sourcePages: [publicPage, privatePage],
  }
}

describe('standard synthetic exam content bundles', () => {
  let root: string
  let directory: string
  let files: ReturnType<typeof syntheticFiles>

  const json = (name: string, value: unknown): Promise<void> => writeFile(path.join(directory, name), JSON.stringify(value), 'utf8')
  const writeBundle = async (): Promise<void> => {
    await Promise.all([
      json('manifest.json', files.manifest), json('content-set.json', files.draft.contentSet),
      json('content.json', files.draft.content), json('solutions.private.json', files.draft.solutions),
      json('source-pages.json', files.sourcePages),
    ])
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'rosie-exams-bundle-'))
    directory = path.join(root, 'bundle')
    await mkdir(directory)
    files = syntheticFiles()
    await writeBundle()
  })
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  it('loads the five fixed files, preserves answers and reports pending readiness', async () => {
    const bundle = await loadExamBundle(directory)
    expect(bundle.draft).toEqual(files.draft)
    expect(bundle.manifest).toEqual(files.manifest)
    expect(bundle.sourcePages).toEqual(files.sourcePages)
    expect(bundle.bundleHash).toMatch(/^[a-f0-9]{64}$/)
    expect(bundle.draftHash).toBe(draftDigest(files.draft))
    expect(bundle.readiness.exam.some(issue => issue.code === 'review_pending')).toBe(true)
    const solution = bundle.draft.solutions.solutions[0]
    if (solution.answerType !== 'gap_fill') throw new Error('Synthetic fixture must use gap fill')
    expect(solution.acceptedAnswerSets).toHaveLength(2)
    expect(solution.acceptedAnswerSets).not.toContainEqual([{ gapId: 'first', value: 'alpha' }, { gapId: 'second', value: 'delta' }])
  })

  it('sorts nested object keys for hashing while preserving array order', () => {
    expect(stableJson({ z: { b: 2, a: 1 }, a: [2, 1] })).toBe(stableJson({ a: [2, 1], z: { a: 1, b: 2 } }))
    expect(stableJson({ a: [2, 1] })).not.toBe(stableJson({ a: [1, 2] }))
  })

  it('ignores JSON formatting and key order but binds bundle hashes to manifest and source pages', async () => {
    const original = await loadExamBundle(directory)
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(files.manifest).reverse()), null, 2))
    const reordered = await loadExamBundle(directory)
    expect(reordered.bundleHash).toBe(original.bundleHash)
    files.manifest.extractionVersion = 'synthetic-fixture-v2'
    await json('manifest.json', files.manifest)
    const changedManifest = await loadExamBundle(directory)
    expect(changedManifest.bundleHash).not.toBe(original.bundleHash)
    expect(changedManifest.draftHash).toBe(original.draftHash)
    files.sourcePages.push({ sourceId: 'synthetic', pdfPage: 8, printedPage: 'S-8', role: 'guidance' })
    await json('source-pages.json', files.sourcePages)
    const changedPages = await loadExamBundle(directory)
    expect(changedPages.bundleHash).not.toBe(changedManifest.bundleHash)
    expect(changedPages.draftHash).toBe(original.draftHash)
  })

  it('requires every content and private solution reference to exist exactly in source-pages', async () => {
    await json('source-pages.json', files.sourcePages.slice(0, 1))
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
    await json('source-pages.json', [{ ...files.sourcePages[0], region: { x: 0, y: 0, width: 1, height: 0.5 } }, files.sourcePages[1]])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects duplicate pages and conflicting printed labels without applying a universal offset', async () => {
    await json('source-pages.json', [...files.sourcePages, files.sourcePages[0]])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
    await json('source-pages.json', [...files.sourcePages, { ...files.sourcePages[0], role: 'guidance', printedPage: 'different-synthetic-label' }])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('requires crops when an extra source-page entry reveals private material on a public page', async () => {
    await json('source-pages.json', [...files.sourcePages, { ...files.sourcePages[0], role: 'solution' }])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ code: 'exam_mixed_role_crop_required', exitCode: 2 })
  })

  it.each([
    { sourceId: 'other-source' }, { sourceSha256: 'b'.repeat(64) }, { sourceSha256: 'A'.repeat(64) },
    { contentSetId: 'other-set' }, { contentRevisionId: 'other-revision' }, { revision: 2 }, { schemaVersion: 2 },
  ])('rejects mismatched manifest identity, hash or version: %j', async (patch) => {
    await json('manifest.json', { ...files.manifest, ...patch })
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects undeclared manifest fields and source-map source editions', async () => {
    await json('manifest.json', { ...files.manifest, sourceFile: '/not-an-authorized-input.pdf' })
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
    await json('manifest.json', files.manifest)
    await json('source-pages.json', [...files.sourcePages, { sourceId: 'another-book', pdfPage: 9, printedPage: null, role: 'solution' }])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects source hashes missing from the content-set snapshot', async () => {
    const { fileHash: omittedHash, ...source } = files.draft.contentSet.source
    expect(omittedHash).toBe(files.manifest.sourceSha256)
    await json('content-set.json', { ...files.draft.contentSet, source })
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('refuses fixed-file symlinks escaping the bundle directory', async () => {
    const outside = path.join(root, 'outside-content.json')
    await writeFile(outside, JSON.stringify(files.draft.content))
    await rm(path.join(directory, 'content.json'))
    await symlink(outside, path.join(directory, 'content.json'))
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('requires regular JSON files and enforces the per-file byte limit', async () => {
    await rm(path.join(directory, 'content.json'))
    await mkdir(path.join(directory, 'content.json'))
    await expect(loadExamBundle(directory)).rejects.toBeInstanceOf(ExamImportError)
    await rm(path.join(directory, 'content.json'), { recursive: true })
    await writeFile(path.join(directory, 'content.json'), ' '.repeat(2 * 1024 * 1024 + 1))
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('rejects malformed JSON and non-object content documents', async () => {
    await writeFile(path.join(directory, 'manifest.json'), '{unfinished')
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
    await json('manifest.json', files.manifest)
    await json('content.json', [])
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2 })
  })

  it('refuses client-authored approval flags despite otherwise valid files', async () => {
    files.draft.content.materials[0].provenance.review = { status: 'approved', reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-11-13T00:00:00Z' }
    await writeBundle()
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ exitCode: 2, issues: expect.arrayContaining([expect.objectContaining({ code: 'review_not_authorized' })]) })
  })

  it('encodes the entire API envelope and counts Chinese text as UTF-8 bytes', () => {
    const requestId = '11111111-1111-4111-8111-111111111111'
    const expectedVersion = '22222222-2222-4222-8222-222222222222'
    expect(JSON.parse(encodeSaveBody(files.draft, requestId))).toEqual({ draft: files.draft, requestId })
    expect(JSON.parse(encodeSaveBody(files.draft, requestId, expectedVersion))).toEqual({ draft: files.draft, requestId, expectedVersion })
    files.draft.content.materials[0].blocks.push(...Array.from({ length: 18 }, (_, index) => ({ id: `synthetic-text-${index}`, kind: 'text' as const, text: '中'.repeat(40_000) })))
    const ordinaryJson = JSON.stringify({ draft: files.draft, requestId, expectedVersion })
    expect(ordinaryJson.length).toBeLessThan(2 * 1024 * 1024)
    expect(Buffer.byteLength(ordinaryJson, 'utf8')).toBeGreaterThan(2 * 1024 * 1024)
    expect(() => encodeSaveBody(files.draft, requestId, expectedVersion)).toThrowError(ExamImportError)
  })

  it('rejects an oversized complete request even when each input file is below the limit', async () => {
    files.draft.content.materials[0].blocks.push(...Array.from({ length: 30 }, (_, index) => ({ id: `long-text-${index}`, kind: 'text' as const, text: '中'.repeat(10_000) })))
    const solution = files.draft.solutions.solutions[0]
    solution.explanations = Array.from({ length: 40 }, () => ({ text: '文'.repeat(10_000), provenance: solution.provenance }))
    expect(Buffer.byteLength(JSON.stringify(files.draft.content), 'utf8')).toBeLessThan(2 * 1024 * 1024)
    expect(Buffer.byteLength(JSON.stringify(files.draft.solutions), 'utf8')).toBeLessThan(2 * 1024 * 1024)
    await writeBundle()
    await expect(loadExamBundle(directory)).rejects.toMatchObject({ code: 'exam_payload_too_large', exitCode: 2 })
  })
})
