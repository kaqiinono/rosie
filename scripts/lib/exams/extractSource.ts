import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, link, lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { ExamImportError, stableJson } from './bundle'
import type { SelectedSourceGroups } from './sourceMap'

export const EXAM_EXTRACTION_DPI = 200
export const EXAM_EXTRACTOR_VERSION = 'exams-pages-v1'
const JSON_LIMIT = 2 * 1024 * 1024
const MANIFEST_LIMIT = 8 * 1024 * 1024
const TEXT_LIMIT = 8 * 1024 * 1024
const IMAGE_LIMIT = 64 * 1024 * 1024
const HASH = /^[0-9a-f]{64}$/

export type PdfTool = 'pdfinfo' | 'pdftoppm' | 'pdftotext'
export type RunPdfTool = (tool: PdfTool, args: readonly string[], options: {
  timeoutMs: number; maxBufferBytes: number
}) => Promise<{ stdout: string; stderr?: string }>

export interface ExtractSourceOptions {
  input: string
  output: string
  resume?: boolean
  runTool?: RunPdfTool
  now?: () => number
}

export interface ExtractionSummary {
  sourceId: string
  sourceSha256: string
  pageCount: number
  selectedPages: readonly number[]
  renderedPages: number
  reusedPages: number
  warnings: readonly { code: 'exam_text_layer_empty'; pdfPage: number }[]
  outputDirectory: string
  manifestPath: string
}

interface PageRecord {
  pdfPage: number
  cacheKey: string
  status: 'pending' | 'complete'
  imageHash: string
  textHash: string
  metadataHash: string
  textLayer: 'present' | 'empty'
}

interface ExtractionManifest {
  schemaVersion: 1
  extractorVersion: string
  dpi: number
  sourceId: string
  sourceSha256: string
  pageCount: number
  mapHash: string
  selectionHash: string
  selectedPages: readonly number[]
  updatedAt: string
  pages: Record<string, PageRecord>
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function code(error: unknown, value: string): boolean { return object(error) && error.code === value }
function digest(value: unknown): string { return createHash('sha256').update(stableJson(value)).digest('hex') }
function io(): ExamImportError { return new ExamImportError('exam_extraction_io', 1) }
function changed(): ExamImportError { return new ExamImportError('exam_extraction_artifact_changed', 2) }
function inside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

async function readBounded(path: string, maximum: number): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > maximum) throw changed()
    const buffer = Buffer.alloc(maximum + 1)
    let length = 0
    while (length < buffer.length) {
      const result = await handle.read(buffer, length, buffer.length - length, null)
      if (!result.bytesRead) break
      length += result.bytesRead
    }
    if (length > maximum) throw changed()
    return buffer.subarray(0, length)
  } finally { await handle.close() }
}

async function fileHash(path: string, maximum: number): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > maximum) throw changed()
    const hash = createHash('sha256')
    let bytes = 0
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += (chunk as Buffer).length
      if (bytes > maximum) throw changed()
      hash.update(chunk as Buffer)
    }
    return hash.digest('hex')
  } catch (error) {
    if (code(error, 'ENOENT')) return null
    if (code(error, 'ELOOP')) throw changed()
    throw error
  } finally { await handle?.close() }
}

async function writeAtomic(path: string, value: unknown): Promise<void> {
  const content = stableJson(value)
  if (Buffer.byteLength(content, 'utf8') > MANIFEST_LIMIT) throw new ExamImportError('exam_extraction_mismatch', 2)
  const temporary = `${path}.${randomUUID()}.tmp`
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    await handle.writeFile(content, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, path)
    const directory = await open(dirname(path), constants.O_RDONLY)
    try { await directory.sync() } finally { await directory.close() }
  } finally {
    await handle?.close()
    await unlink(temporary).catch(() => undefined)
  }
}

const defaultRunTool: RunPdfTool = (tool, args, options) => new Promise((resolveTool, reject) => {
  execFile(tool, [...args], {
    encoding: 'utf8', timeout: options.timeoutMs, maxBuffer: options.maxBufferBytes,
    killSignal: 'SIGKILL', windowsHide: true, env: { ...process.env, LC_ALL: 'C' },
  }, (error, stdout, stderr) => {
    if (error) reject(error)
    else resolveTool({ stdout, stderr })
  })
})

async function run(tool: PdfTool, args: readonly string[], options: ExtractSourceOptions): Promise<string> {
  try {
    const result = await (options.runTool ?? defaultRunTool)(tool, args, {
      timeoutMs: tool === 'pdftoppm' ? 120_000 : 30_000, maxBufferBytes: JSON_LIMIT,
    })
    if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout, 'utf8') > JSON_LIMIT) {
      throw new ExamImportError(`exam_${tool}_failed`, 1)
    }
    return result.stdout
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    const reason = code(error, 'ENOENT') ? 'missing' : code(error, 'ETIMEDOUT') || (object(error) && error.killed === true) ? 'timeout' : 'failed'
    throw new ExamImportError(`exam_${tool}_${reason}`, 1)
  }
}

async function outputPath(requested: string, input: string): Promise<string> {
  if (!requested.trim()) throw new ExamImportError('exam_extraction_path_invalid', 2)
  const absolute = resolve(requested)
  let ancestor = absolute
  while (true) {
    try {
      const info = await lstat(ancestor)
      if (!info.isDirectory() || (ancestor === absolute && info.isSymbolicLink())) throw new ExamImportError('exam_extraction_path_invalid', 2)
      break
    } catch (error) {
      if (!code(error, 'ENOENT')) throw error
      const parent = dirname(ancestor)
      if (parent === ancestor) throw new ExamImportError('exam_extraction_path_invalid', 2)
      ancestor = parent
    }
  }
  const canonical = resolve(await realpath(ancestor), relative(ancestor, absolute))
  if (inside(canonical, input)) throw new ExamImportError('exam_extraction_path_invalid', 2)
  await mkdir(canonical, { recursive: true, mode: 0o700 })
  const stat = await lstat(canonical)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ExamImportError('exam_extraction_path_invalid', 2)
  return canonical
}

function pageKey(sourceSha256: string, pdfPage: number): string {
  return digest({ sourceSha256, pdfPage, dpi: EXAM_EXTRACTION_DPI, extractorVersion: EXAM_EXTRACTOR_VERSION })
}

function parseManifest(value: unknown, expected: ExtractionManifest): ExtractionManifest {
  const mismatch = () => new ExamImportError('exam_extraction_mismatch', 2)
  if (!object(value) || !object(value.pages) || typeof value.updatedAt !== 'string') throw mismatch()
  const identity = ['schemaVersion', 'extractorVersion', 'dpi', 'sourceId', 'sourceSha256', 'pageCount', 'mapHash', 'selectionHash', 'selectedPages'] as const
  if (identity.some(key => !Object.hasOwn(value, key) || stableJson(value[key]) !== stableJson(expected[key]))) throw mismatch()
  const pages: Record<string, PageRecord> = {}
  for (const [key, entry] of Object.entries(value.pages)) {
    if (!object(entry) || typeof entry.pdfPage !== 'number' || String(entry.pdfPage) !== key || !expected.selectedPages.includes(entry.pdfPage)
      || entry.cacheKey !== pageKey(expected.sourceSha256, entry.pdfPage) || (entry.status !== 'pending' && entry.status !== 'complete')
      || !['imageHash', 'textHash', 'metadataHash'].every(field => typeof entry[field] === 'string' && HASH.test(entry[field] as string))
      || (entry.textLayer !== 'present' && entry.textLayer !== 'empty')) throw mismatch()
    pages[key] = entry as unknown as PageRecord
  }
  return { ...expected, updatedAt: value.updatedAt, pages }
}

function artifacts(directory: string, page: number) {
  const prefix = join(directory, 'pages', `page-${String(page).padStart(5, '0')}`)
  return [
    { path: `${prefix}.png`, field: 'imageHash' as const, limit: IMAGE_LIMIT },
    { path: `${prefix}.txt`, field: 'textHash' as const, limit: TEXT_LIMIT },
    { path: `${prefix}.json`, field: 'metadataHash' as const, limit: JSON_LIMIT },
  ]
}

/** Generate private source material only. No OCR, content authoring or publication. */
export async function extractExamSource(selection: SelectedSourceGroups, options: ExtractSourceOptions): Promise<ExtractionSummary> {
  let source: Awaited<ReturnType<typeof open>> | undefined
  let lock: Awaited<ReturnType<typeof open>> | undefined
  let lockPath: string | undefined
  try {
    source = await open(resolve(options.input), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const initial = await source.stat()
    if (!initial.isFile()) throw new ExamImportError('exam_extraction_path_invalid', 2)
    const input = await realpath(options.input)
    const assertSource = async () => {
      const current = await lstat(input)
      const held = await source!.stat()
      if (!current.isFile() || current.isSymbolicLink() || current.ino !== initial.ino || current.dev !== initial.dev
        || [current, held].some(info => info.size !== initial.size || info.mtimeMs !== initial.mtimeMs || info.ctimeMs !== initial.ctimeMs)) {
        throw new ExamImportError('exam_source_changed', 2)
      }
    }
    const hash = createHash('sha256')
    for await (const chunk of source.createReadStream({ autoClose: false })) hash.update(chunk as Buffer)
    const sourceSha256 = hash.digest('hex')
    await assertSource()
    if (sourceSha256 !== selection.source.sha256) throw new ExamImportError('exam_source_hash_mismatch', 2)
    const pages = [...new Set(selection.pages.map(page => page.reference.pdfPage))].sort((a, b) => a - b)
    if (!pages.length || pages.some(page => !Number.isSafeInteger(page) || page < 1 || page > selection.source.pageCount)) {
      throw new ExamImportError('exam_source_page_out_of_range', 2)
    }
    const output = await outputPath(options.output, input)
    lockPath = join(output, '.extraction.lock')
    try {
      lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    } catch (error) {
      if (code(error, 'EEXIST')) throw new ExamImportError('exam_extraction_locked', 1)
      throw error
    }
    await lock.writeFile(JSON.stringify({ pid: process.pid }), 'utf8')
    await lock.sync()
    const manifestPath = join(output, 'extraction-manifest.json')
    const now = () => new Date((options.now ?? Date.now)()).toISOString()
    let manifest: ExtractionManifest = {
      schemaVersion: 1, extractorVersion: EXAM_EXTRACTOR_VERSION, dpi: EXAM_EXTRACTION_DPI,
      sourceId: selection.source.id, sourceSha256, pageCount: selection.source.pageCount,
      mapHash: selection.mapHash, selectionHash: selection.selectionHash, selectedPages: pages, updatedAt: now(), pages: {},
    }
    try {
      const inputManifest = await readBounded(manifestPath, MANIFEST_LIMIT)
      if (!options.resume) throw new ExamImportError('exam_extraction_resume_required', 2)
      let value: unknown
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inputManifest)) as unknown }
      catch { throw new ExamImportError('exam_extraction_mismatch', 2) }
      manifest = parseManifest(value, manifest)
      await chmod(manifestPath, 0o600)
    } catch (error) {
      if (!code(error, 'ENOENT')) throw error
      if (options.resume) throw new ExamImportError('exam_extraction_resume_missing', 2)
      if ((await readdir(output)).some(name => name !== '.extraction.lock')) {
        throw new ExamImportError('exam_extraction_output_not_empty', 2)
      }
    }
    await chmod(output, 0o700)
    const info = await run('pdfinfo', [input], options)
    await assertSource()
    const pageMatch = /^Pages:\s+(\d+)\s*$/m.exec(info)
    if (!pageMatch || !Number.isSafeInteger(Number(pageMatch[1])) || Number(pageMatch[1]) < 1) {
      throw new ExamImportError('exam_pdfinfo_invalid', 2)
    }
    const actualPageCount = Number(pageMatch[1])
    if (pages.some(page => page > actualPageCount)) throw new ExamImportError('exam_source_page_out_of_range', 2)
    if (actualPageCount !== selection.source.pageCount) throw new ExamImportError('exam_source_page_count_mismatch', 2)
    const pageDirectory = join(output, 'pages')
    await mkdir(pageDirectory, { mode: 0o700 }).catch(error => { if (!code(error, 'EEXIST')) throw error })
    const directoryStat = await lstat(pageDirectory)
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new ExamImportError('exam_extraction_path_invalid', 2)
    await chmod(pageDirectory, 0o700)
    await writeAtomic(manifestPath, manifest)
    let renderedPages = 0
    let reusedPages = 0
    for (const page of pages) {
      await assertSource()
      const prior = manifest.pages[String(page)]
      const destinations = artifacts(output, page)
      const existing = await Promise.all(destinations.map(item => fileHash(item.path, item.limit)))
      if (existing.some((value, index) => value !== null && (!prior || value !== prior[destinations[index].field]))) throw changed()
      if (prior && existing.every(value => value !== null)) {
        prior.status = 'complete'
        reusedPages += 1
        for (const item of destinations) await chmod(item.path, 0o600)
        manifest.updatedAt = now()
        await writeAtomic(manifestPath, manifest)
        continue
      }
      const temporary = await mkdtemp(join(output, '.page-'))
      await chmod(temporary, 0o700)
      try {
        const imagePrefix = join(temporary, 'page')
        const imagePath = `${imagePrefix}.png`
        const textPath = join(temporary, 'page.txt')
        const metadataPath = join(temporary, 'page.json')
        await run('pdftoppm', ['-f', String(page), '-l', String(page), '-r', String(EXAM_EXTRACTION_DPI), '-singlefile', '-png', input, imagePrefix], options)
        await assertSource()
        await run('pdftotext', ['-f', String(page), '-l', String(page), '-layout', '-enc', 'UTF-8', input, textPath], options)
        await assertSource()
        const text = await readBounded(textPath, TEXT_LIMIT)
        let textValue: string
        try { textValue = new TextDecoder('utf-8', { fatal: true }).decode(text) }
        catch { throw new ExamImportError('exam_pdftotext_failed', 1) }
        const textLayer = textValue.trim() ? 'present' as const : 'empty' as const
        const cacheKey = pageKey(sourceSha256, page)
        await writeAtomic(metadataPath, {
          schemaVersion: 1, extractorVersion: EXAM_EXTRACTOR_VERSION, dpi: EXAM_EXTRACTION_DPI,
          sourceId: selection.source.id, sourceSha256, pdfPage: page, cacheKey, textLayer,
          pages: selection.pages.filter(item => item.reference.pdfPage === page),
        })
        const generated = [imagePath, textPath, metadataPath]
        const hashes = await Promise.all(generated.map((path, index) => fileHash(path, destinations[index].limit)))
        if (hashes.some(value => value === null) || hashes[0] === createHash('sha256').digest('hex')) {
          throw new ExamImportError('exam_pdf_artifact_missing', 1)
        }
        const entry: PageRecord = {
          pdfPage: page, cacheKey, status: 'pending', textLayer,
          imageHash: hashes[0]!, textHash: hashes[1]!, metadataHash: hashes[2]!,
        }
        if (prior && destinations.some(item => prior[item.field] !== entry[item.field])) throw changed()
        // Reserve these exact bytes before publishing any file. A crash between
        // links is recoverable without treating an unknown manual file as ours.
        manifest.pages[String(page)] = entry
        manifest.updatedAt = now()
        await writeAtomic(manifestPath, manifest)
        for (let index = 0; index < generated.length; index += 1) {
          await chmod(generated[index], 0o600)
          const artifact = await open(generated[index], constants.O_RDONLY | constants.O_NOFOLLOW)
          try { await artifact.sync() } finally { await artifact.close() }
          try { await link(generated[index], destinations[index].path) }
          catch (error) {
            if (!code(error, 'EEXIST')) throw error
            if (await fileHash(destinations[index].path, destinations[index].limit) !== entry[destinations[index].field]) throw changed()
          }
          await chmod(destinations[index].path, 0o600)
        }
        const directory = await open(pageDirectory, constants.O_RDONLY)
        try { await directory.sync() } finally { await directory.close() }
        entry.status = 'complete'
        manifest.updatedAt = now()
        await writeAtomic(manifestPath, manifest)
        renderedPages += 1
      } finally { await rm(temporary, { recursive: true, force: true }) }
    }
    await assertSource()
    return {
      sourceId: selection.source.id, sourceSha256, pageCount: actualPageCount, selectedPages: pages,
      renderedPages, reusedPages, outputDirectory: output, manifestPath,
      warnings: pages.filter(page => manifest.pages[String(page)].textLayer === 'empty')
        .map(pdfPage => ({ code: 'exam_text_layer_empty' as const, pdfPage })),
    }
  } catch (error) {
    if (error instanceof ExamImportError) throw error
    if (code(error, 'ELOOP') || code(error, 'ENOTDIR')) throw new ExamImportError('exam_extraction_path_invalid', 2)
    throw io()
  } finally {
    await source?.close()
    if (lock && lockPath) {
      try {
        const held = await lock.stat()
        const current = await lstat(lockPath)
        await lock.close()
        if (held.ino === current.ino && held.dev === current.dev) await unlink(lockPath)
      } finally { await lock.close().catch(() => undefined) }
    }
  }
}
