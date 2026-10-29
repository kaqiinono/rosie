#!/usr/bin/env node
/** Repository/fixture inventory by default. No env files, DB clients, uploads or private media.
 * See docs/task-material-inventory.md and packages/tasks/README.md.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createJiti } from 'jiti'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const resourceKinds = new Set(['passage', 'vocabulary', 'recognize', 'write', 'poem', 'accumulation', 'dictation', 'grammar', 'writing', 'audio', 'replay', 'problems'])
const subjects = new Set(['chinese', 'english', 'math', 'art', 'science', 'sports', 'dance', 'piano', 'swimming', 'other'])
function atomicJson(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, file)
}
function integer(value, min, max, name) {
  if (!/^\d+$/.test(value ?? '') || Number(value) < min || Number(value) > max) throw new Error(`invalid_${name}`)
  return Number(value)
}
export function parseArgs(args) {
  const options = { pageSize: 100, maxPages: 1000, rateMs: 0, resume: false, dryRun: false, allowRemote: false }
  const valued = { '--fixture': 'fixture', '--out': 'out', '--checkpoint': 'checkpoint', '--remote-url': 'remoteUrl', '--cursor': 'cursor', '--page-size': 'pageSize', '--max-pages': 'maxPages', '--rate-ms': 'rateMs' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help') options.help = true
    else if (arg === '--resume') options.resume = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--allow-remote') options.allowRemote = true
    else if (valued[arg]) {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error(`missing_value:${arg}`)
      options[valued[arg]] = value
    } else throw new Error(`unknown_option:${arg}`)
  }
  options.pageSize = integer(String(options.pageSize), 1, 500, 'page_size')
  options.maxPages = integer(String(options.maxPages), 1, 1000, 'max_pages')
  options.rateMs = integer(String(options.rateMs), 0, 60000, 'rate_ms')
  if (options.fixture && options.remoteUrl) throw new Error('choose_one_source')
  if (options.remoteUrl && !options.allowRemote) throw new Error('remote_requires_explicit_opt_in')
  if (options.remoteUrl && !args.includes('--max-pages')) throw new Error('remote_requires_page_budget')
  if (options.out && !options.checkpoint) options.checkpoint = `${options.out}.checkpoint.json`
  if (options.resume && (!options.checkpoint || options.cursor)) throw new Error('resume_requires_checkpoint_without_cursor')
  if (options.checkpoint && !options.out && !options.dryRun) throw new Error('checkpoint_requires_output')
  if (options.out && options.checkpoint && resolve(options.out) === resolve(options.checkpoint)) throw new Error('output_checkpoint_must_differ')
  return options
}

/** Real TypeScript exports, including generated/factory problems. Never import a package's UI barrel. */
export async function loadRepositoryInventory() {
  const jiti = createJiti(import.meta.url, { fsCache: false, jsx: { runtime: 'automatic' }, alias: {
    '@rosie/math-content': resolve(root, 'packages/math-content/src'),
    '@rosie/math-kit': resolve(root, 'packages/math-kit/src'),
    // Styling does not own problem metadata; preserve all actual checker/figure factories.
    './gong.css': resolve(root, 'scripts/task-material-catalog-style.json'),
  } })
  const load = path => jiti.import(resolve(root, path))
  const adapters = await load('apps/web/src/components/tasks/taskCatalogAdapters.ts')
  const records = [], gaps = []
  for (const book of ['g1b', 'g2a', 'g2b']) {
    const base = `packages/chinese/src/utils/${book}`
    const [{ UNITS }, { LESSON_CHARS }, { LESSON_PASSAGES }, { POEMS }, { ACCUMULATION }] = await Promise.all([
      load(`${base}/units.ts`), load(`${base}/lesson-chars.ts`), load(`${base}/lesson-passages.ts`), load(`${base}/poems.ts`), load(`${base}/accumulation.ts`),
    ])
    const dictationPath = `${base}/pinyin-write-words.ts`
    let dictation = existsSync(resolve(root, dictationPath)) ? (await load(dictationPath)).PINYIN_WRITE_WORDS : []
    const teacherPath = `${base}/pinyin-write-words-teacher.ts`
    if (existsSync(resolve(root, teacherPath))) {
      const teacher = (await load(teacherPath)).PINYIN_WRITE_WORDS_TEACHER
      dictation = [...new Map([...dictation, ...teacher].map(row => [`${row.lessonKey}:${row.word}`, row])).values()]
    }
    const rows = UNITS.flatMap(unit => unit.lessons.flatMap(meta => {
      const kind = meta.kind ?? 'lesson'
      const found = LESSON_CHARS.find(row => row.unit === unit.unit && row.lesson === meta.lesson && row.lessonKind === kind)
      if (!found) { gaps.push({ key: `chinese:${book}:unit:${unit.unit}:${kind}:${meta.lesson}`, code: 'directory_missing_stable_key', detail: meta.title }); return [] }
      return [{ lessonKey: found.lessonKey, lessonTitle: meta.title, lessonKind: kind, lesson: meta.lesson, unit: unit.unit, sortOrder: 0 }]
    })).map((row, sortOrder) => ({ ...row, sortOrder }))
    const resources = Object.fromEntries(rows.map(row => [row.lessonKey, adapters.chineseResources(row.lessonKey, row.unit, row.lesson, row.lessonKind, { passages: LESSON_PASSAGES, poems: POEMS, accumulation: ACCUMULATION, dictation, chars: LESSON_CHARS })]))
    for (const lesson of adapters.adaptChineseCatalog([{ book, lessons: rows, resources }])) records.push({ key: `chinese:${lesson.key}`, subject: 'chinese', visibility: 'shared', lesson, evidence: 'repository-text-and-backup' })
    for (const row of LESSON_CHARS) if (!rows.some(lesson => lesson.lessonKey === row.lessonKey)) gaps.push({ key: `chinese:${book}:${row.lessonKey}`, code: 'backup_outside_registered_directory' })
  }
  const [{ SAMPLE_WORDS }, { SAMPLE_WORDS_4B }, { SAMPLE_WORDS_5A }, { readingPassages }] = await Promise.all([
    load('packages/english/src/utils/english-data.ts'), load('packages/english/src/utils/english-data-4b.ts'), load('packages/english/src/utils/english-data-5a.ts'), load('packages/english/src/utils/reading-data.ts'),
  ])
  for (const lesson of adapters.adaptEnglishCatalog([...SAMPLE_WORDS, ...SAMPLE_WORDS_4B, ...SAMPLE_WORDS_5A], readingPassages)) records.push({ key: `english:${lesson.key}`, subject: 'english', visibility: 'shared', lesson, evidence: 'repository-text-and-vocabulary-backup' })
  const { GRAMMAR_INDEX } = await load('packages/english/src/grammar/grammar-index.ts')
  gaps.push({ key: 'english:grammar_units', code: 'remote_unverified', detail: `Static grammar index has ${GRAMMAR_INDEX.length} entries; this does not measure hosted units.` })
  const { LESSONS } = await load('packages/math-kit/src/utils/lesson-registry.ts')
  const math = adapters.adaptMathCatalog(LESSONS)
  for (const entry of LESSONS) {
    const lesson = math.find(row => row.key === entry.lessonKey)
    const base = `packages/math-content/src/utils/g${entry.grade}/lesson${entry.seq}-data`
    const path = [base + '.ts', base + '.tsx'].find(path => existsSync(resolve(root, path)))
    let problems = []
    try {
      if (!path) throw new Error('registered_data_file_missing')
      problems = adapters.adaptMathProblems(entry, (await load(path)).PROBLEMS)
      if (!problems.length) throw new Error('registered_problem_bank_empty')
      lesson.resources = [{ kind: 'problems', status: 'available', count: problems.length }, { kind: 'replay', status: 'unverified' }]
    } catch (error) {
      gaps.push({ key: `math:${entry.lessonKey}`, code: 'problem_source_failed', detail: error.message.replaceAll(root, '<repo>') })
    }
    records.push({ key: `math:${lesson.key}`, subject: 'math', visibility: 'shared', lesson, problems, evidence: 'registered-repository-problems' })
  }
  for (const key of ['audio_assets', 'reading_passage_media', 'flipbook_media', 'baidu_audio_files', 'math_video_lesson_catalog', 'story_narration']) gaps.push({ key, code: 'remote_unverified' })
  return { records, gaps }
}

/** Whitelist output; a feed cannot smuggle private clip paths or arbitrary fields into shared inventory. */
function normalizeRecord(row, gaps) {
  if (!row || row.visibility !== 'shared') {
    gaps.push({ key: 'source', code: 'private_source_excluded' })
    return null
  }
  const lesson = row.lesson
  if (!subjects.has(row.subject) || typeof row.key !== 'string' || !lesson || typeof lesson.key !== 'string' || !lesson.key || row.key !== `${row.subject}:${lesson.key}` || ['title', 'book', 'unit', 'kind'].some(field => typeof lesson[field] !== 'string')) throw new Error('invalid_inventory_record')
  const resources = (lesson.resources ?? []).map(resource => {
    if (!resourceKinds.has(resource.kind) || !['available', 'missing', 'unverified'].includes(resource.status)) throw new Error('invalid_resource')
    // Only navigation references from the repository application; never signed/private media URLs.
    const ref = typeof resource.ref === 'string' && /^\/(?:english|chinese|math)\//.test(resource.ref) && !resource.ref.includes('?') ? resource.ref : undefined
    return { kind: resource.kind, status: resource.status, ...(ref ? { ref } : {}), ...(Number.isSafeInteger(resource.count) && resource.count >= 0 ? { count: resource.count } : {}) }
  })
  for (const resource of resources) if (resource.status !== 'available') gaps.push({ key: row.key, code: `${resource.status}_${resource.kind}` })
  const href = typeof lesson.href === 'string' && /^\/(?:english|chinese|math)\//.test(lesson.href) && !lesson.href.includes('?') ? lesson.href : undefined
  return {
    key: row.key, subject: row.subject, lesson: { key: lesson.key, ...(Number.isFinite(lesson.order) ? { order: lesson.order } : {}), title: lesson.title, book: lesson.book, unit: lesson.unit, kind: lesson.kind, ...(Number.isInteger(lesson.lesson) ? { lesson: lesson.lesson } : {}), ...(href ? { href } : {}), resources },
    ...(Array.isArray(row.problems) ? { problems: row.problems.map(problem => {
      if (!problem || typeof problem.id !== 'string' || !problem.id || problem.lesson_key !== lesson.key || !['pretest', 'lesson', 'homework', 'workbook', 'supplement'].includes(problem.group) || problem.key !== `${problem.group}:${problem.id}` || problem.stable_key !== `${encodeURIComponent(lesson.key)}:${problem.group}:${encodeURIComponent(problem.id)}` || typeof problem.title !== 'string' || typeof problem.displayId !== 'string' || !Number.isSafeInteger(problem.order) || problem.order < 0 || !Array.isArray(problem.tags) || problem.tags.some(tag => typeof tag !== 'string')) throw new Error('invalid_inventory_problem')
      const href = typeof problem.href === 'string' && /^\/math\/ny\//.test(problem.href) && !problem.href.includes('?') ? problem.href : undefined
      return { key: problem.key, stable_key: problem.stable_key, id: problem.id, lesson_key: problem.lesson_key, group: problem.group, displayId: problem.displayId, order: problem.order, tags: problem.tags, title: problem.title, ...(href ? { href } : {}) }
    }) } : {}),
    evidence: typeof row.evidence === 'string' ? row.evidence : 'supplied-shared-feed',
  }
}
const normalizeGaps = gaps => [...new Map(gaps.map(gap => {
  if (!gap || typeof gap.key !== 'string' || typeof gap.code !== 'string') throw new Error('invalid_gap')
  const clean = { key: gap.key, code: gap.code, ...(typeof gap.detail === 'string' ? { detail: gap.detail } : {}) }
  return [JSON.stringify(clean), clean]
})).values()].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)))

export async function runInventory(options, dependencies = {}) {
  const sleep = dependencies.sleep ?? delay
  const request = dependencies.fetch ?? fetch
  let source, local, endpoint
  if (options.remoteUrl) {
    endpoint = new URL(options.remoteUrl)
    if (endpoint.protocol !== 'https:') throw new Error('remote_requires_https')
    if (endpoint.username || endpoint.password) throw new Error('remote_url_credentials_forbidden')
    source = { kind: 'remote', fingerprint: digest(options.remoteUrl) }
  } else {
    local = options.fixture ? readJson(options.fixture) : await loadRepositoryInventory()
    if (!Array.isArray(local.records) || (local.gaps && !Array.isArray(local.gaps))) throw new Error('invalid_inventory_source')
    source = { kind: options.fixture ? 'fixture' : 'repository', fingerprint: digest(local) }
  }
  let checkpoint = { schema: 1, source, cursor: options.cursor ?? null, records: [], gaps: local?.gaps ?? [], complete: false, revision: null, partialPrefix: !!options.cursor }
  if (options.resume) {
    checkpoint = readJson(options.checkpoint)
    if (checkpoint.schema !== 1 || checkpoint.source?.fingerprint !== source.fingerprint || checkpoint.source?.kind !== source.kind) throw new Error('checkpoint_source_changed')
    if (!Array.isArray(checkpoint.records) || !Array.isArray(checkpoint.gaps) || typeof checkpoint.complete !== 'boolean') throw new Error('invalid_checkpoint')
  }
  const records = new Map(checkpoint.records.map(record => [record.key, record]))
  const gaps = [...checkpoint.gaps]
  let cursor = checkpoint.cursor, complete = checkpoint.complete, revision = checkpoint.revision
  const seen = new Set()
  const persist = () => {
    const scanComplete = complete && !checkpoint.partialPrefix
    const manifest = { schema: 1, source, scan_complete: scanComplete, complete: scanComplete && !gaps.some(gap => gap.code.endsWith('_source_failed')), records: [...records.values()].sort((a, b) => compare(a.key, b.key)), gaps: normalizeGaps(gaps) }
    if (checkpoint.partialPrefix) manifest.gaps = normalizeGaps([...manifest.gaps, { key: 'source', code: 'cursor_prefix_not_included' }])
    if (!options.dryRun && options.out) {
      atomicJson(options.out, manifest)
      atomicJson(options.checkpoint, { schema: 1, source, cursor, complete, records: manifest.records, gaps: manifest.gaps, revision, partialPrefix: checkpoint.partialPrefix })
    }
    return manifest
  }
  for (let pageIndex = 0; !complete && pageIndex < options.maxPages; pageIndex++) {
    let page
    if (endpoint) {
      if (seen.has(cursor)) throw new Error('remote_cursor_repeated')
      seen.add(cursor)
      if (pageIndex > 0 || options.resume) await sleep(Math.max(100, options.rateMs))
      const url = new URL(endpoint)
      url.searchParams.set('limit', String(options.pageSize))
      if (cursor !== null) url.searchParams.set('cursor', cursor)
      // 429/503 use a bounded retry; each request has a timeout, redirects are rejected.
      for (let retry = 0; retry < 3; retry++) {
        const response = await request(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } })
        if ([429, 503].includes(response.status) && retry < 2) {
          const retryAfter = response.headers.get('retry-after')
          const seconds = Number(retryAfter)
          const parsedDate = Date.parse(retryAfter ?? '')
          const retryMs = retryAfter && Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(parsedDate) ? Math.max(0, parsedDate - Date.now()) : 1000 * 2 ** retry
          if (retryMs > 60000) throw new Error('retry_after_exceeds_budget')
          await sleep(Math.max(100, options.rateMs, retryMs)); continue
        }
        if (!response.ok) throw new Error(`remote_http_${response.status}`)
        const raw = await response.text()
        if (raw.length > 5_000_000) throw new Error('remote_page_too_large')
        page = JSON.parse(raw); break
      }
      if (!page || !Array.isArray(page.records) || page.records.length > options.pageSize || typeof page.complete !== 'boolean' || typeof page.revision !== 'string' || !page.revision || (!page.complete && (typeof page.cursor !== 'string' || !page.cursor || page.cursor === cursor))) throw new Error('invalid_remote_page')
      if (revision && revision !== page.revision) throw new Error('remote_revision_changed')
      revision = page.revision
    } else {
      const offset = cursor === null ? 0 : integer(String(cursor), 0, local.records.length, 'cursor')
      const end = Math.min(offset + options.pageSize, local.records.length)
      page = { records: local.records.slice(offset, end), cursor: String(end), complete: end === local.records.length }
    }
    for (const row of page.records) {
      const record = normalizeRecord(row, gaps)
      if (!record) continue
      const previous = records.get(record.key)
      if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error(`conflicting_record:${record.key}`)
      records.set(record.key, record)
    }
    if (page.gaps) gaps.push(...page.gaps)
    cursor = page.cursor ?? null
    complete = page.complete
    persist()
  }
  return persist()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write('node scripts/task-material-catalog.mjs [--fixture file | --remote-url https://feed --allow-remote --max-pages N] [--out manifest.json] [--checkpoint file --resume] [--page-size 1..500] [--max-pages 1..1000] [--rate-ms 0..60000] [--cursor token] [--dry-run]\nDefault source: repository TypeScript catalogs. Default output: stdout only. Remote GET feed requires records/gaps/cursor/complete/revision; only explicitly shared records are accepted. No env files, remote writes, or private recordings.\n')
    return
  }
  const manifest = await runInventory(options)
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
  process.stderr.write(`catalog records=${manifest.records.length} gaps=${manifest.gaps.length} complete=${manifest.complete}\n`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
