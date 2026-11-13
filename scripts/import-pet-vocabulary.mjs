#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const DATA = fileURLToPath(new URL('../docs/pet/data/', import.meta.url))
const STAGE = 'PET'
const PAGE_SIZE = 500
const MAX_NETWORK_ATTEMPTS = 4
const WORD_COLUMNS = [
  'explanation', 'chinese_def', 'ipa', 'example', 'part_of_speech', 'word_forms',
  'syllables', 'keywords',
]
const ITEM_COLUMNS = [
  'id', 'kind', 'prompt', 'acceptedAnswerSets', 'options', 'explanation',
  'translation', 'senseId', 'source', 'targetForm', 'spokenText',
]
const ITEM_KINDS = new Set(['context', 'spelling', 'listening', 'word_form'])
const SET_KINDS = new Set(['sentence', 'exam', 'forms'])
const ADMIN_ID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const strings = (value) => Array.isArray(value) && value.every(nonempty)
const normalize = (value) => value.normalize('NFKC').toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[‐‑]/g, '-').trim().replace(/\s+/g, ' ')
const businessKey = ({ unit, lesson, word }) => JSON.stringify([unit, lesson, word])

function databaseWordKey(master) {
  const exact = new Map(master.filter((entry) => entry.caseSensitive === true).map((entry) => [entry.word, entry.key]))
  return (word) => exact.get(word) ?? normalize(word)
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function selectFields(source, names) {
  return Object.fromEntries(names.filter((key) => source[key] != null).map((key) => [key, source[key]]))
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function indexUnique(rows, getKey, label) {
  const indexed = new Map()
  for (const row of rows) {
    const key = getKey(row)
    ensure(!indexed.has(key), `Duplicate ${label}: ${key}`)
    indexed.set(key, row)
  }
  return indexed
}

async function loadPlan({ data, sets, sample }) {
  const [master, allocations, approval, sourceManifest, candidates, queue] = await Promise.all(
    ['master-vocabulary.json', 'allocations.json', 'reviewed-words.json', 'source-manifest.json',
      'sentence-sets.json', 'review-queue.json'].map((file) => readJson(resolve(data, file))),
  )
  const wordsByKey = indexUnique(master, (row) => row.key, 'candidate word key')
  indexUnique(master, businessKey, 'PET business key')
  indexUnique(master, ({ unit, position }) => JSON.stringify([unit, position]), 'PET allocation position')

  const approvedWords = approval.filter((word) => word.reviewed === true)
  const reviewedWords = indexUnique(approvedWords, (word) => word.key, 'reviewed word key')
  const sampleGroup = await readJson(resolve(data, 'reviewed-sentence-set.json'))
  const sampleKeys = new Set(sampleGroup.items.map((item) => item.wordKey))
  const selectedWords = approvedWords
    .filter((word) => !sample || word.scope === 'topic-sample' || sampleKeys.has(word.key))
    .map((word) => {
      const entry = wordsByKey.get(word.key)
      const location = allocations[word.key]
      ensure(entry && location && entry.stage === STAGE &&
        (entry.caseSensitive === true ? entry.word === word.key : normalize(entry.word) === word.key) &&
        entry.unit === location.unit && entry.lesson === location.lesson &&
        entry.primaryTopic === location.primaryTopic && entry.position === location.position,
      `Missing or inconsistent frozen location for ${word.key}`)
      const fields = selectFields(word.fields, WORD_COLUMNS)
      ensure(nonempty(word.revision) && nonempty(fields.explanation) && nonempty(fields.chinese_def) &&
        nonempty(fields.ipa) && nonempty(fields.example) && strings(fields.part_of_speech) &&
        fields.part_of_speech.length > 0,
      `Incomplete reviewed word: ${word.key}`)
      const { content } = word
      ensure(content?.primaryTopic === location.primaryTopic && strings(content.topics) &&
        content.topics.includes(location.primaryTopic) && strings(content.aliases) &&
        strings(content.priorities) && Array.isArray(content.sources) && content.sources.length > 0 &&
        content.sources.every((source) => nonempty(source.file) && Number.isInteger(source.page) && source.page > 0) &&
        Array.isArray(content.senses) && content.senses.length > 0,
      `Incomplete reviewed PET content: ${word.key}`)
      indexUnique(content.senses, (sense) => sense.id, `sense ID for ${word.key}`)
      for (const sense of content.senses) {
        ensure([sense.id, sense.definitionEn, sense.definitionZh, sense.example, sense.exampleZh].every(nonempty) &&
          strings(sense.partOfSpeech) && sense.partOfSpeech.length > 0 &&
          strings(sense.collocations) && (sense.confusions === undefined || strings(sense.confusions)),
        `Incomplete sense for ${word.key}`)
      }
      return { key: word.key, revision: word.revision, content,
        row: { stage: STAGE, unit: location.unit, lesson: location.lesson, word: entry.word, ...fields } }
    })

  const optionalSets = sample ? [] : (await readdir(data))
    .filter((name) => ['exam-sets.json', 'form-exercises.json'].includes(name))
    .map((name) => resolve(data, name))
  const extras = await Promise.all([...optionalSets, ...sets.map((path) => resolve(path))].map(readJson))
  const allSets = indexUnique([...candidates, ...extras.flat()], (set) => set.id, 'exercise set ID')
  // The independently reviewed copy replaces the matching extraction snapshot.
  ensure(allSets.get(sampleGroup.id)?.kind === 'sentence', 'Reviewed sample must reference its original set')
  allSets.set(sampleGroup.id, sampleGroup)
  const selectedKeys = new Set(selectedWords.map((entry) => entry.key))
  const selectedSets = []
  const deferredSets = []
  const itemIds = new Set()
  for (const set of allSets.values()) {
    if (set.reviewed !== true || (sample && set.id !== sampleGroup.id)) continue
    ensure(nonempty(set.id) && SET_KINDS.has(set.kind) && nonempty(set.revision) &&
      nonempty(set.title) && Array.isArray(set.items) && set.items.length > 0 && set.items.length <= 100 &&
      strings(set.word_pool ?? []), `Invalid reviewed set: ${set.id}`)
    if (set.kind === 'exam') {
      const choice = set.items.every((item) => Array.isArray(item.options) && item.options.length === 4 &&
        new Set(item.options.map(normalize)).size === 4)
      const open = set.items.every((item) => item.options === undefined)
      ensure(nonempty(set.passage) && set.items.length === 6 && (choice || open) &&
        JSON.stringify(set.passage.match(/\[[1-6]\]/g)) === JSON.stringify(['[1]', '[2]', '[3]', '[4]', '[5]', '[6]']),
      `Exam set must contain one passage and six ordered gaps: ${set.id}`)
      if (open) ensure(set.items.every((item) => Array.isArray(item.acceptedAnswerSets) &&
        item.acceptedAnswerSets.every((answers) => Array.isArray(answers) && answers.length === 1 &&
          nonempty(answers[0]) && !/\s/.test(answers[0].trim()))),
      `Part 6 accepts one word per gap: ${set.id}`)
    }
    const missingWords = new Set()
    const unreviewedItems = []
    for (const item of set.items) {
      const blanks = (item.prompt?.match(/_{3,}/g) ?? []).length
      ensure(nonempty(item.id) && !itemIds.has(item.id) && ITEM_KINDS.has(item.kind) &&
        nonempty(item.prompt) && nonempty(item.wordKey) && blanks > 0 &&
        Array.isArray(item.acceptedAnswerSets) && item.acceptedAnswerSets.length > 0 &&
        item.acceptedAnswerSets.every((answers) => strings(answers) && answers.length === blanks) &&
        (item.options === undefined || (strings(item.options) && blanks === 1 &&
          item.acceptedAnswerSets.every(([answer]) =>
            item.options.some((option) => normalize(option) === normalize(answer))))),
      `Invalid reviewed item: ${item.id ?? set.id}`)
      itemIds.add(item.id)
      if (item.reviewed !== true) unreviewedItems.push(item.id)
      if (!selectedKeys.has(item.wordKey)) missingWords.add(item.wordKey)
      if (item.senseId && selectedKeys.has(item.wordKey)) {
        ensure(reviewedWords.get(item.wordKey).content.senses.some((sense) => sense.id === item.senseId),
          `Unknown sense ${item.senseId} in ${item.id}`)
      }
    }
    if (missingWords.size || unreviewedItems.length) {
      deferredSets.push({ id: set.id, unresolvedWordKeys: [...missingWords], unreviewedItems })
    } else selectedSets.push(set)
  }

  return { master, sourceManifest, queue, selectedWords, selectedSets, deferredSets,
    pendingSets: [...allSets.values()].filter((set) => set.reviewed !== true).length,
    pendingWords: master.length - approvedWords.length }
}

async function fetchWithRetry(input, init) {
  for (let attempt = 1; ; attempt += 1) {
    let response
    try {
      response = await fetch(input, init)
    } catch (error) {
      if (attempt === MAX_NETWORK_ATTEMPTS || init?.signal?.aborted) throw error
    }
    if (response && (attempt === MAX_NETWORK_ATTEMPTS || (response.status !== 429 && response.status < 500))) {
      return response
    }
    const retryAfter = response?.headers.get('Retry-After')
    const retryAfterMs = retryAfter == null ? 0 : /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0
    await response?.body?.cancel()
    const waitMs = Math.max(retryAfterMs, Math.min(15000, 250 * 2 ** (attempt - 1) + Math.random() * 200))
    console.warn(`PET request retry ${attempt}/${MAX_NETWORK_ATTEMPTS - 1} in ${Math.ceil(waitMs)} ms`)
    await new Promise((done) => setTimeout(done, waitMs))
  }
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  ensure(url && key, 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const requireFromCore = createRequire(new URL('../packages/core/package.json', import.meta.url))
  const { createClient } = requireFromCore('@supabase/supabase-js')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithRetry },
  })
}

async function query(request, label) {
  const { data, error } = await request
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

function reportDatabase(master, rows) {
  const known = new Set(master.map((word) => word.key))
  const keyOf = databaseWordKey(master)
  const matches = new Map()
  for (const row of rows) {
    if (row.stage === STAGE) continue
    const key = keyOf(row.word)
    if (!known.has(key)) continue
    const stages = matches.get(key) ?? Object.create(null)
    const stage = row.stage ?? '(unset)'
    stages[stage] = (stages[stage] ?? 0) + 1
    matches.set(key, stages)
  }
  return {
    petRows: rows.filter((row) => row.stage === STAGE).length,
    overlapRequiresSenseReview: [...matches].map(([key, stages]) => ({ key, stages })),
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function changedFields(before, after) {
  return Object.keys(after).filter((key) => JSON.stringify(canonical(before?.[key])) !== JSON.stringify(canonical(after[key])))
}

function plannedChange(before, after) {
  const fields = changedFields(before, after)
  return {
    action: !before ? 'insert' : fields.length ? 'update' : 'unchanged',
    fields,
    ...(Object.hasOwn(after, 'revision') ? { previousRevision: before?.revision ?? null, revision: after.revision } : {}),
  }
}

function contentPayload(entry) {
  return { revision: entry.revision, content: entry.content, published: true }
}

function setPayload(set, idByKey) {
  return {
    revision: set.revision, kind: set.kind, title: set.title,
    topic: set.topic ?? null, passage: set.passage ?? null, word_pool: set.word_pool ?? [],
    items: set.items.map((item) => ({
      ...selectFields(item, ITEM_COLUMNS), wordEntryId: idByKey.get(item.wordKey) ?? null,
    })),
    published: true,
  }
}

async function readPages(load, label) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await query(load().range(start, start + PAGE_SIZE - 1), label)
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function comparePlan(client, plan) {
  const [wordRows, contentRows, setRows] = await Promise.all([
    readPages(() => client.from('word_entries')
      .select(['id', 'word', 'stage', 'unit', 'lesson', ...WORD_COLUMNS].join(','))
      .eq('stage', STAGE).order('id'), 'Read PET words'),
    readPages(() => client.from('pet_word_content').select('word_entry_id,revision,content,published')
      .order('word_entry_id'), 'Read PET content'),
    readPages(() => client.from('pet_exercise_sets').select('id,revision,kind,title,topic,passage,word_pool,items,published')
      .order('id'), 'Read PET exercise sets'),
  ])
  const byKey = new Map()
  const keyOf = databaseWordKey(plan.master)
  for (const row of wordRows) {
    const key = keyOf(row.word)
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  }
  const byContentId = indexUnique(contentRows, (row) => row.word_entry_id, 'database content ID')
  const bySetId = indexUnique(setRows, (row) => row.id, 'database set ID')
  const idByKey = new Map()
  const words = plan.selectedWords.map((entry) => {
    const matches = byKey.get(entry.key) ?? []
    const before = matches.find((row) => businessKey(row) === businessKey(entry.row))
    if (before) idByKey.set(entry.key, before.id)
    return {
      key: entry.key,
      locationConflicts: matches.filter((row) => row.id !== before?.id)
        .map(({ unit, lesson, word }) => ({ unit, lesson, word })),
      word: plannedChange(before, entry.row),
      content: plannedChange(byContentId.get(before?.id), contentPayload(entry)),
    }
  })
  const sets = plan.selectedSets.map((set) => ({
    id: set.id, ...plannedChange(bySetId.get(set.id), setPayload(set, idByKey)),
  }))
  return { words, sets, idByKey }
}

async function applyPlan(client, creator, plan, comparison, progress, checkpoint, concurrency) {
  ensure(ADMIN_ID.test(creator ?? ''), '--creator must be an existing admin UUID')
  const { user } = await query(client.auth.admin.getUserById(creator), 'Read creator account')
  ensure(user?.id === creator.toLowerCase() && user.app_metadata?.role === 'admin',
    '--creator must be an existing admin UUID')

  const conflict = comparison.words.find((entry) => entry.locationConflicts.length > 0)
  ensure(!conflict, `Existing PET location for ${conflict?.key} differs from the frozen allocation`)

  const idByKey = new Map(comparison.idByKey)
  let checkpointQueue = Promise.resolve()
  const saveCheckpoint = () => {
    checkpointQueue = checkpointQueue.then(checkpoint)
    return checkpointQueue
  }
  const applyWord = async (entry, index) => {
    const { key, row } = entry
    const { word, content } = comparison.words[index]
    progress.current = { kind: 'word', id: key }
    if (word.action !== 'unchanged') {
      const { stage, unit, lesson, word: spelling, ...fields } = row
      if (word.action === 'insert') {
        // Ignore a concurrent insert and use the winning row's original ID.
        await query(client.from('word_entries').upsert({ ...row, creator }, {
          onConflict: 'unit,lesson,word,stage', ignoreDuplicates: true,
        }), `Ensure PET word ${key}`)
      }
      const { id } = await query(client.from('word_entries').update(fields)
        .eq('stage', stage).eq('unit', unit).eq('lesson', lesson).eq('word', spelling)
        .select('id').single(), `Update PET word ${key}`)
      idByKey.set(key, id)
    }
    if (content.action !== 'unchanged') {
      await query(client.from('pet_word_content').upsert({
        word_entry_id: idByKey.get(key), ...contentPayload(entry),
      }, { onConflict: 'word_entry_id' }), `Publish PET content ${key}`)
    }
    progress.wordsCompleted += 1
    if (((word.action !== 'unchanged' || content.action !== 'unchanged') && progress.wordsCompleted % 20 === 0) ||
        progress.wordsCompleted === plan.selectedWords.length) {
      console.log(`PET words: ${progress.wordsCompleted}/${plan.selectedWords.length}`)
      await saveCheckpoint()
    }
  }

  let cursor = 0, failure = null
  const workers = Array.from({ length: Math.min(concurrency, plan.selectedWords.length) }, async () => {
    while (!failure && cursor < plan.selectedWords.length) {
      const index = cursor++
      try { await applyWord(plan.selectedWords[index], index) }
      catch (error) { failure ??= error }
    }
  })
  // Finish in-flight writes before reporting failure; a rerun resumes from database state.
  await Promise.all(workers)
  await checkpointQueue
  if (failure) throw failure

  for (const [index, set] of plan.selectedSets.entries()) {
    progress.current = { kind: 'set', id: set.id }
    if (comparison.sets[index].action !== 'unchanged') {
      const payload = setPayload(set, idByKey)
      ensure(payload.items.every((item) => item.wordEntryId), `Missing imported PET word in ${set.id}`)
      await query(client.from('pet_exercise_sets').upsert({
        id: set.id, ...payload,
      }, { onConflict: 'id' }), `Publish PET set ${set.id}`)
    }
    progress.setsCompleted += 1
    console.log(`PET sets: ${progress.setsCompleted}/${plan.selectedSets.length}`)
    await checkpoint()
  }
  progress.current = null
}

async function main() {
  const { values } = parseArgs({ options: {
    apply: { type: 'boolean' },
    sample: { type: 'boolean' },
    'compare-db': { type: 'boolean' },
    creator: { type: 'string' },
    concurrency: { type: 'string', default: '1' },
    data: { type: 'string', default: DATA },
    report: { type: 'string', default: 'output/pet/import-report.json' },
    set: { type: 'string', multiple: true, default: [] },
    help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) {
    console.log('pnpm pet:import [--sample] [--report path] [--compare-db] [--set path] [--data dir] [--apply --creator uuid --concurrency 1]')
    return
  }
  const concurrency = Number(values.concurrency)
  ensure(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 8, '--concurrency must be an integer from 1 to 8')
  const plan = await loadPlan({ data: resolve(values.data), sets: values.set, sample: values.sample })
  const client = values.apply || values['compare-db'] ? getClient() : null
  const [existing, comparison] = client
    ? await Promise.all([
      readPages(() => client.from('word_entries').select('word,stage').order('id'), 'Read word library'),
      comparePlan(client, plan),
    ])
    : [[], null]
  const report = {
    mode: values.apply ? 'apply-requested' : 'dry-run',
    sourceManifest: plan.sourceManifest,
    candidateWords: plan.master.length,
    reviewQueueEntries: plan.queue.length,
    pendingLexicalReview: plan.pendingWords,
    pendingSets: plan.pendingSets,
    approvedWords: plan.selectedWords.map(({ key, row }) => ({ key, unit: row.unit, lesson: row.lesson })),
    approvedSets: plan.selectedSets.map((set) => ({ id: set.id, items: set.items.length })),
    deferredSets: plan.deferredSets,
    database: client ? {
      ...reportDatabase(plan.master, existing),
      wordChanges: comparison.words,
      setChanges: comparison.sets,
    } : null,
    apply: values.apply ? { status: 'pending', wordsCompleted: 0, setsCompleted: 0, current: null } : null,
  }
  const reportPath = resolve(values.report)
  await mkdir(dirname(reportPath), { recursive: true })
  const saveReport = () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
  await saveReport()
  console.log(`PET report: ${reportPath}`)
  if (values.apply) {
    try {
      report.apply.status = 'in-progress'
      await saveReport()
      await applyPlan(client, values.creator, plan, comparison, report.apply, saveReport, concurrency)
      report.apply.status = 'completed'
    } catch (error) {
      report.apply.status = 'failed'
      report.apply.error = error.message
      throw error
    } finally {
      await saveReport()
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
