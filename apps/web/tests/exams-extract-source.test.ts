// @vitest-environment node

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractExamSource, type RunPdfTool } from '../../../scripts/lib/exams/extractSource'
import { loadExamSourceMap, selectExamSourceGroups, type ExamSourceMap, type SelectedSourceGroups } from '../../../scripts/lib/exams/sourceMap'

const NOW = Date.parse('2026-11-13T00:00:00Z')
const PDF_BYTES = Buffer.from('%PDF-1.4\n% Synthetic fixture; PDF tools are mocked, never executed.\n%%EOF\n')
const SOURCE_HASH = createHash('sha256').update(PDF_BYTES).digest('hex')
// Fixed synthetic renderer output, deliberately unrelated to any source book.
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL8sAAAAASUVORK5CYII=', 'base64')

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T

function syntheticMap(): Mutable<ExamSourceMap> {
  return {
    schemaVersion: 1,
    sources: [{
      id: 'synthetic', title: 'Synthetic source; not real PDF extraction', sha256: SOURCE_HASH, pageCount: 4, coverage: 'partial',
      pages: [
        { id: 'question', reference: { sourceId: 'synthetic', pdfPage: 1, printedPage: 'S-1', role: 'exam' }, kind: 'question', review: 'pending' },
        { id: 'answer', reference: { sourceId: 'synthetic', pdfPage: 3, printedPage: 'S-3', role: 'solution' }, kind: 'answer', review: 'pending' },
        { id: 'script', reference: { sourceId: 'synthetic', pdfPage: 3, printedPage: 'S-3', role: 'teacher_notes' }, kind: 'script', review: 'pending' },
        { id: 'training', reference: { sourceId: 'synthetic', pdfPage: 2, printedPage: 'S-2', role: 'training' }, kind: 'question', review: 'pending' },
      ],
      groups: [
        { id: 'exam-group', testNumber: 1, role: 'exam', sectionId: 'reading_writing', partNumber: 1, pageIds: ['question', 'answer', 'script'] },
        { id: 'training-group', testNumber: 1, role: 'training', sectionId: 'reading_writing', partNumber: 1, pageIds: ['training'] },
      ],
    }],
  }
}

describe('private local exam source extraction with mocked PDF tools', () => {
  let root: string
  let input: string
  let output: string
  let mapPath: string
  let map: Mutable<ExamSourceMap>
  let selection: SelectedSourceGroups
  let actualPageCount: number
  let failRenderPage: number | null
  let emptyTextPages: Set<number>
  const runTool = vi.fn<RunPdfTool>()

  const reloadSelection = async (): Promise<SelectedSourceGroups> => {
    await writeFile(mapPath, JSON.stringify(map), 'utf8')
    return selectExamSourceGroups(await loadExamSourceMap(mapPath), { sourceId: 'synthetic', testNumber: 1, role: 'exam' })
  }
  const extract = (resume = false) => extractExamSource(selection, { input, output, resume, runTool, now: () => NOW })
  const artifact = (page: number, extension: string): string => path.join(output, 'pages', `page-${String(page).padStart(5, '0')}.${extension}`)
  const renderedPageNumbers = (): number[] => runTool.mock.calls.filter(([tool]) => tool === 'pdftoppm').map(([, args]) => Number(args[1]))

  beforeEach(async () => {
    root = await realpath(await mkdtemp(path.join(tmpdir(), 'rosie-exams-extract-')))
    // Spaces and shell punctuation must remain one literal argument, never a shell command.
    input = path.join(root, 'synthetic source ; literal.pdf')
    output = path.join(root, 'extraction')
    mapPath = path.join(root, 'synthetic-map.json')
    await writeFile(input, PDF_BYTES)
    map = syntheticMap()
    selection = await reloadSelection()
    actualPageCount = 4
    failRenderPage = null
    emptyTextPages = new Set<number>()
    runTool.mockReset().mockImplementation(async (tool, args) => {
      if (tool === 'pdfinfo') return { stdout: `Pages: ${actualPageCount}\n` }
      const page = Number(args[1])
      const destination = args.at(-1)
      if (!destination) throw new Error('Mock requires an explicit output path')
      if (tool === 'pdftoppm') {
        if (page === failRenderPage) throw new Error('Synthetic renderer failure')
        await writeFile(`${destination}.png`, PNG_BYTES)
      } else {
        await writeFile(destination, emptyTextPages.has(page) ? ' \n\f' : `Synthetic text for page ${page}.\n`, 'utf8')
      }
      return { stdout: '' }
    })
  })
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  it('renders the whole selected group including private pages using explicit argument arrays', async () => {
    const result = await extract()
    expect(result).toMatchObject({ sourceId: 'synthetic', sourceSha256: SOURCE_HASH, pageCount: 4, selectedPages: [1, 3], renderedPages: 2, reusedPages: 0, warnings: [] })
    expect(result.outputDirectory).toBe(output)
    expect(result.manifestPath).toBe(path.join(output, 'extraction-manifest.json'))
    expect(renderedPageNumbers()).toEqual([1, 3])
    expect(runTool.mock.calls.find(([tool]) => tool === 'pdfinfo')?.[1]).toEqual([input])
    for (const [tool, args, limits] of runTool.mock.calls) {
      expect(limits.timeoutMs).toBeGreaterThan(0)
      expect(limits.maxBufferBytes).toBeGreaterThan(0)
      if (tool === 'pdfinfo') continue
      const page = args[1]
      if (tool === 'pdftoppm') expect(args.slice(0, -1)).toEqual(['-f', page, '-l', page, '-r', '200', '-singlefile', '-png', input])
      else expect(args.slice(0, -1)).toEqual(['-f', page, '-l', page, '-layout', '-enc', 'UTF-8', input])
      expect(path.relative(output, args.at(-1) ?? '')).not.toMatch(/^\.\./)
    }
    for (const page of [1, 3]) {
      expect(await readFile(artifact(page, 'png'))).toEqual(PNG_BYTES)
      expect(await readFile(artifact(page, 'txt'), 'utf8')).toBe(`Synthetic text for page ${page}.\n`)
      expect(JSON.parse(await readFile(artifact(page, 'json'), 'utf8'))).toBeTypeOf('object')
      expect((await stat(artifact(page, 'png'))).mode & 0o777).toBe(0o600)
      expect((await stat(artifact(page, 'txt'))).mode & 0o777).toBe(0o600)
      expect((await stat(artifact(page, 'json'))).mode & 0o777).toBe(0o600)
    }
    expect((await stat(output)).mode & 0o777).toBe(0o700)
    expect((await stat(result.manifestPath)).mode & 0o777).toBe(0o600)
    await expect(readFile(path.join(output, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves source PDF, mapping and selection inputs without creating a question bundle', async () => {
    const mapBefore = await readFile(mapPath)
    const selectionBefore = JSON.stringify(selection)
    await extract()
    expect(await readFile(input)).toEqual(PDF_BYTES)
    expect(await readFile(mapPath)).toEqual(mapBefore)
    expect(JSON.stringify(selection)).toBe(selectionBefore)
    await expect(readFile(path.join(output, 'content.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(path.join(output, 'solutions.private.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports missing text as a warning while retaining the page image and original text layer', async () => {
    emptyTextPages.add(3)
    const result = await extract()
    expect(result.warnings).toContainEqual({ code: 'exam_text_layer_empty', pdfPage: 3 })
    expect(result.renderedPages).toBe(2)
    expect(await readFile(artifact(3, 'png'))).toEqual(PNG_BYTES)
    expect((await readFile(artifact(3, 'txt'), 'utf8')).trim()).toBe('')
    runTool.mockClear()
    const resumed = await extract(true)
    expect(resumed.warnings).toContainEqual({ code: 'exam_text_layer_empty', pdfPage: 3 })
    expect(resumed.reusedPages).toBe(2)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('rejects a source hash mismatch before invoking any PDF tool', async () => {
    await writeFile(input, Buffer.from('%PDF synthetic different edition'))
    await expect(extract()).rejects.toMatchObject({ code: 'exam_source_hash_mismatch', exitCode: 2 })
    expect(runTool).not.toHaveBeenCalled()
  })

  it('stops on actual page-count mismatch and never renders out-of-range selected pages', async () => {
    actualPageCount = 2
    await expect(extract()).rejects.toMatchObject({ exitCode: 2 })
    expect(renderedPageNumbers()).toEqual([])
  })

  it('rejects unreadable pdfinfo output instead of guessing the page count', async () => {
    runTool.mockResolvedValue({ stdout: 'Synthetic diagnostic with no page count' })
    await expect(extract()).rejects.toMatchObject({ code: 'exam_pdfinfo_invalid', exitCode: 2 })
    expect(runTool.mock.calls.every(([tool]) => tool === 'pdfinfo')).toBe(true)
  })

  it('requires explicit resume for an existing workspace and reuses complete matching artifacts', async () => {
    await extract()
    runTool.mockClear()
    await expect(extract()).rejects.toMatchObject({ code: 'exam_extraction_resume_required', exitCode: 2 })
    expect(renderedPageNumbers()).toEqual([])
    runTool.mockClear()
    const result = await extract(true)
    expect(result.renderedPages).toBe(0)
    expect(result.reusedPages).toBe(2)
    expect(runTool.mock.calls.every(([tool]) => tool === 'pdfinfo')).toBe(true)
  })

  it.each(['png', 'txt', 'json'])('rebuilds only the page with a deleted %s artifact during resume', async (extension) => {
    await extract()
    await rm(artifact(1, extension))
    runTool.mockClear()
    const result = await extract(true)
    expect(result.renderedPages).toBe(1)
    expect(result.reusedPages).toBe(1)
    expect(renderedPageNumbers()).toEqual([1])
    expect((await stat(artifact(1, extension))).isFile()).toBe(true)
  })

  it('preserves completed pages after failure and resumes only unfinished work', async () => {
    failRenderPage = 3
    await expect(extract()).rejects.toMatchObject({ code: 'exam_pdftoppm_failed', exitCode: 1 })
    expect(await readFile(artifact(1, 'png'))).toEqual(PNG_BYTES)
    expect((await stat(path.join(output, 'extraction-manifest.json'))).isFile()).toBe(true)
    failRenderPage = null
    runTool.mockClear()
    const result = await extract(true)
    expect(result.renderedPages).toBe(1)
    expect(result.reusedPages).toBe(1)
    expect(renderedPageNumbers()).toEqual([3])
  })

  it('refuses changed mapping and selection identities instead of reusing old pages', async () => {
    await extract()
    map.sources[0].title = 'Changed synthetic mapping metadata'
    selection = await reloadSelection()
    runTool.mockClear()
    await expect(extract(true)).rejects.toMatchObject({ code: 'exam_extraction_mismatch', exitCode: 2 })
    expect(renderedPageNumbers()).toEqual([])
    map = syntheticMap()
    await reloadSelection()
    selection = selectExamSourceGroups(await loadExamSourceMap(mapPath), { sourceId: 'synthetic', testNumber: 1, role: 'training' })
    await expect(extract(true)).rejects.toMatchObject({ code: 'exam_extraction_mismatch', exitCode: 2 })
    expect(renderedPageNumbers()).toEqual([])
  })

  it.each([{ dpi: 150 }, { extractorVersion: 'synthetic-other-extractor' }])('refuses incompatible persisted extraction configuration: %j', async (patch) => {
    await extract()
    const manifestPath = path.join(output, 'extraction-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
    expect(manifest).toMatchObject({ schemaVersion: 1, dpi: 200, extractorVersion: 'exams-pages-v1', sourceSha256: SOURCE_HASH })
    await writeFile(manifestPath, JSON.stringify({ ...manifest, ...patch }))
    runTool.mockClear()
    await expect(extract(true)).rejects.toMatchObject({ code: 'exam_extraction_mismatch', exitCode: 2 })
    expect(renderedPageNumbers()).toEqual([])
  })

  it('does not overwrite a manually edited artifact on resume', async () => {
    await extract()
    const manualText = 'Synthetic manual transcription; keep this edit.'
    await writeFile(artifact(1, 'txt'), manualText)
    runTool.mockClear()
    await expect(extract(true)).rejects.toMatchObject({ code: 'exam_extraction_artifact_changed', exitCode: 2 })
    expect(await readFile(artifact(1, 'txt'), 'utf8')).toBe(manualText)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('does not claim nonempty directories or allow resume with no extraction state', async () => {
    await expect(extract(true)).rejects.toMatchObject({ code: 'exam_extraction_resume_missing', exitCode: 2 })
    await mkdir(output, { recursive: true })
    const manualPath = path.join(output, 'manual-notes.txt')
    await writeFile(manualPath, 'Synthetic notes that must not be overwritten.')
    await expect(extract()).rejects.toMatchObject({ code: 'exam_extraction_output_not_empty', exitCode: 2 })
    expect(await readFile(manualPath, 'utf8')).toBe('Synthetic notes that must not be overwritten.')
  })

  it('leaves an existing lock intact instead of stealing another extraction workspace', async () => {
    await mkdir(output, { recursive: true })
    const lockPath = path.join(output, '.extraction.lock')
    const lock = JSON.stringify({ pid: 999999, note: 'Synthetic held lock' })
    await writeFile(lockPath, lock, { mode: 0o600 })
    await expect(extract()).rejects.toMatchObject({ code: 'exam_extraction_locked', exitCode: 1 })
    expect(await readFile(lockPath, 'utf8')).toBe(lock)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('rejects output symlinks and a source PDF located inside the output directory', async () => {
    const elsewhere = path.join(root, 'elsewhere')
    await mkdir(elsewhere)
    await symlink(elsewhere, output)
    await expect(extract()).rejects.toMatchObject({ code: 'exam_extraction_path_invalid', exitCode: 2 })
    await rm(output)
    await mkdir(output)
    const nestedInput = path.join(output, 'source.pdf')
    await writeFile(nestedInput, PDF_BYTES)
    await expect(extractExamSource(selection, { input: nestedInput, output, runTool, now: () => NOW })).rejects.toMatchObject({ code: 'exam_extraction_path_invalid', exitCode: 2 })
    expect(await readFile(nestedInput)).toEqual(PDF_BYTES)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('rejects symlinked artifacts on resume without modifying their targets', async () => {
    await extract()
    await rm(artifact(1, 'png'))
    await symlink(input, artifact(1, 'png'))
    runTool.mockClear()
    await expect(extract(true)).rejects.toMatchObject({ exitCode: 2 })
    expect(await readFile(input)).toEqual(PDF_BYTES)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('reports a missing tool safely without installation or another processing fallback', async () => {
    runTool.mockRejectedValue(Object.assign(new Error('Synthetic private tool diagnostic'), { code: 'ENOENT' }))
    const error: unknown = await extract().catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'exam_pdfinfo_missing', exitCode: 1 })
    expect(String(error)).not.toContain('Synthetic private tool diagnostic')
    expect(runTool).toHaveBeenCalledTimes(1)
    expect(runTool.mock.calls[0][0]).toBe('pdfinfo')
  })

  it('reports a tool timeout without invoking another extractor', async () => {
    runTool.mockRejectedValue(Object.assign(new Error('Synthetic tool timeout'), { code: 'ETIMEDOUT' }))
    await expect(extract()).rejects.toMatchObject({ code: 'exam_pdfinfo_timeout', exitCode: 1 })
    expect(runTool).toHaveBeenCalledTimes(1)
    expect(renderedPageNumbers()).toEqual([])
  })

  it('stops if the source PDF changes during a mocked render', async () => {
    const delegate = runTool.getMockImplementation()
    if (!delegate) throw new Error('Expected synthetic PDF tool runner')
    runTool.mockImplementation(async (tool, args, limits) => {
      const result = await delegate(tool, args, limits)
      if (tool === 'pdftoppm') await writeFile(input, Buffer.from('%PDF synthetic concurrent replacement'))
      return result
    })
    await expect(extract()).rejects.toMatchObject({ code: 'exam_source_changed', exitCode: 2 })
    expect(runTool.mock.calls.some(([tool]) => tool === 'pdftotext')).toBe(false)
    await expect(readFile(artifact(1, 'png'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
