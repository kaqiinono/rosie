#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { LEVELS, MAX_ITEMS } from '../packages/english/src/assessment/model.ts'

const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url))
const { createClient } = requireWeb('@supabase/supabase-js')
const BANKS = 'vocabulary_assessment_banks'
const ATTEMPTS = 'vocabulary_assessment_attempts'
const LISTS = ['KET', 'PET', 'FCE']
const PAGE_SIZE = 500
const MIN_PER_LEVEL = MAX_ITEMS / LEVELS.length
const clean = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : ''
const optionKey = value => clean(value).toLowerCase().replace(/[.!?]+$/u, '').trim()

const { values } = parseArgs({
  options: {
    prepare: { type: 'string' },
    reviewed: { type: 'string' },
    calibration: { type: 'string' },
    apply: { type: 'boolean' },
    'trial-export': { type: 'string' },
    version: { type: 'string' },
  },
})

function database() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase server configuration')
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
}

async function query(request) {
  const { data, error } = await request
  if (error) {
    if (error.message?.trimStart().startsWith('<')) throw new Error('Supabase returned an upstream connection error')
    throw new Error(error.message)
  }
  return data
}

async function readPages(makeQuery) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await query(makeQuery().order('id').range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(20_000)))
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function catalog(db) {
  const [positions, senses] = await Promise.all([
    readPages(() => db.from('vocabulary_positions')
      .select('id,stage,headword_id,standard_spelling,verified_sense_ids').in('stage', LISTS)),
    readPages(() => db.from('vocabulary_senses')
      .select('id,headword_id,revision,cefr,cefr_source,written').eq('verified', true)),
  ])

  const headwords = new Map()
  for (const row of positions) {
    const word = headwords.get(row.headword_id) ?? {
      spelling: row.standard_spelling, lists: new Set(), senses: new Map(),
    }
    word.lists.add(row.stage)
    for (const id of row.verified_sense_ids) {
      const sources = word.senses.get(id) ?? new Set()
      sources.add(row.stage)
      word.senses.set(id, sources)
    }
    headwords.set(row.headword_id, word)
  }
  const ranked = new Map()
  const missingLevel = []
  for (const sense of senses) {
    const word = headwords.get(sense.headword_id)
    const sourceLists = word?.senses.get(sense.id)
    if (!sourceLists) continue
    const { written } = sense
    const definitionEn = clean(written?.definitionEn)
    const definitionZh = clean(written?.definitionZh)
    const partOfSpeech = Array.isArray(written?.partOfSpeech)
      ? written.partOfSpeech.map(clean).find(Boolean) : ''
    // Counting is per single-word headword; phrases remain available in the course catalog.
    if (!/^[a-z]+(?:[-'’][a-z]+)*$/iu.test(word.spelling) || !partOfSpeech || !definitionEn || !definitionZh) continue
    if (!sense.cefr) {
      missingLevel.push({ headwordId: sense.headword_id, senseId: sense.id, word: word.spelling,
        definitionEn, definitionZh, partOfSpeech, sourceLists: [...sourceLists].sort() })
      continue
    }
    if (!LEVELS.includes(sense.cefr) || !clean(sense.cefr_source)) continue
    const item = {
      headwordId: sense.headword_id, senseId: sense.id, senseRevision: Number(sense.revision),
      word: word.spelling, level: sense.cefr, partOfSpeech,
      context: word.senses.size > 1 ? clean(written.example) : '',
      requiresContext: word.senses.size > 1,
      definitionEn, definitionZh, cefrSource: sense.cefr_source, sourceLists: [...sourceLists].sort(),
    }
    const matching = ranked.get(item.headwordId) ?? []
    matching.push(item)
    ranked.set(item.headwordId, matching)
  }

  const items = [...ranked.values()].flatMap(group => group
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.senseId.localeCompare(b.senseId))
    .map((item, index) => ({ ...item, item_role: index === 0 ? 'main' : 'diagnostic' })))
  items.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
    a.word.localeCompare(b.word) || a.senseId.localeCompare(b.senseId))

  const overlap = {}
  for (const word of headwords.values()) {
    const key = [...word.lists].sort().join('+')
    overlap[key] = (overlap[key] ?? 0) + 1
  }
  const unrepresentedHeadwords = [...headwords].filter(([id]) => !ranked.has(id))
    .map(([headwordId, word]) => ({ headwordId, word: word.spelling, sourceLists: [...word.lists].sort() }))
  const report = {
    positions: positions.length,
    uniqueHeadwords: headwords.size,
    overlap,
    headwordsWithoutReviewableGradedBilingualSenses: unrepresentedHeadwords.length,
    bilingualSensesMissingLevel: missingLevel.length,
    byLevel: Object.fromEntries(LEVELS.map(level => [level, {
      main: items.filter(item => item.level === level && item.item_role === 'main').length,
      diagnostic: items.filter(item => item.level === level && item.item_role === 'diagnostic').length,
    }])),
  }
  return { items, report, unrepresentedHeadwords, missingLevel }
}

function suggestedDistractors(item, choices) {
  const optionWords = value => new Set(optionKey(value).split(/[^a-z]+/u).filter(word => word.length >= 4))
  const correctWords = optionWords(item.definitionEn)
  const unique = new Set([optionKey(item.definitionEn)])
  const result = []
  const ranked = choices.filter(other => other.level === item.level && other.partOfSpeech === item.partOfSpeech &&
    other.headwordId !== item.headwordId)
    .sort((a, b) => Math.abs(a.definitionEn.length - item.definitionEn.length) -
      Math.abs(b.definitionEn.length - item.definitionEn.length))
  for (const other of ranked) {
    const key = optionKey(other.definitionEn)
    if (unique.has(key) || [...optionWords(other.definitionEn)].some(word => correctWords.has(word))) continue
    unique.add(key)
    result.push(other.definitionEn)
    if (result.length === 3) break
  }
  return result
}

async function prepare(file, { items, report, unrepresentedHeadwords, missingLevel }) {
  let old = []
  try {
    old = JSON.parse(await readFile(file, 'utf8')).items
    if (!Array.isArray(old)) throw new Error('Expected an assessment review file')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const oldBySense = new Map(old.map(item => [item.senseId, item]))
  const output = items.map(item => {
    const prev = oldBySense.get(item.senseId)
    if (prev?.senseRevision === item.senseRevision && prev.level === item.level &&
        prev.item_role === item.item_role && prev.requiresContext === item.requiresContext &&
        prev.word === item.word && prev.partOfSpeech === item.partOfSpeech) {
      return { ...item, context: prev.context, definitionEn: prev.definitionEn,
        definitionZh: prev.definitionZh, distractors: prev.distractors, reviewed: prev.reviewed === true }
    }
    return { ...item, distractors: suggestedDistractors(item, items), reviewed: false }
  })
  await writeFile(file, JSON.stringify({ report, unrepresentedHeadwords, missingLevel, items: output }, null, 2) + '\n')
}

async function createBank(file, calibrationFile, { items }) {
  const draft = JSON.parse(await readFile(file, 'utf8'))
  if (!Array.isArray(draft.items)) throw new Error('Expected a reviewed items array')
  const live = new Map(items.map(item => [item.senseId, item]))
  const seen = new Set()
  const published = []
  for (const row of draft.items) {
    if (row.reviewed !== true) continue
    const source = live.get(row.senseId)
    if (!source || ['senseRevision', 'level', 'item_role', 'headwordId', 'word', 'partOfSpeech', 'requiresContext']
      .some(key => row[key] !== source[key])) {
      throw new Error(`Catalog changed for ${row.word || row.senseId}. Refresh the review file before publishing.`)
    }
    if (seen.has(row.senseId)) throw new Error(`Duplicate sense: ${row.senseId}`)
    seen.add(row.senseId)
    const { senseId, headwordId, senseRevision, word, level, partOfSpeech, item_role } = source
    const context = clean(row.context)
    const definitionEn = clean(row.definitionEn)
    const definitionZh = clean(row.definitionZh)
    const distractors = Array.isArray(row.distractors) ? row.distractors.map(clean) : []
    if ((source.requiresContext && !context) || !/[a-z]/iu.test(definitionEn) ||
        !/\p{Script=Han}/u.test(definitionZh) || distractors.length !== 3 ||
        distractors.some(value => !/[a-z]/iu.test(value)) ||
        new Set([definitionEn, ...distractors].map(optionKey)).size !== 4) {
      throw new Error(`Invalid reviewed question: ${word} / ${senseId}`)
    }
    published.push({ headwordId, senseId, senseRevision, word, level, partOfSpeech, item_role,
      context, definitionEn, definitionZh, distractors })
  }
  published.sort((a, b) => a.senseId.localeCompare(b.senseId))
  const counts = Object.fromEntries(LEVELS.map(level => [level, published.filter(item =>
    item.item_role === 'main' && item.level === level).length]))
  const ready = Object.values(counts).every(count => count >= MIN_PER_LEVEL)
  const calibration = calibrationFile ? JSON.parse(await readFile(calibrationFile, 'utf8')) : null
  const itemsHash = createHash('sha256').update(JSON.stringify(published)).digest('hex')
  if (calibration && (calibration.modelVersion !== 'stratified-v1' ||
      !['raw', 'formula'].includes(calibration.method) || !clean(calibration.reference) ||
      calibration.itemsHash !== itemsHash ||
      typeof calibration.maxRelativeWidth !== 'number' || !Number.isFinite(calibration.maxRelativeWidth) ||
      calibration.maxRelativeWidth <= 0 || calibration.maxRelativeWidth >= 1)) {
    throw new Error('Calibration must reference the exact reviewed bank and have a valid width and method')
  }
  const content = { items: published, calibration }
  const version = 'va-' + createHash('sha256').update(JSON.stringify(content)).digest('hex')
  return { counts, ready, version, itemsHash, content }
}

async function exportTrial(db, version, file) {
  const rows = await readPages(() => db.from(ATTEMPTS).select('id,state,submitted_at')
    .eq('bank_version', version).not('submitted_at', 'is', null))
  const answers = rows.flatMap(row => row.state.answers.map((answer, index) => {
    const question = row.state.questions[index]
    return {
      attempt_id: row.id,
      item_role: answer.item_role,
      position: index + 1,
      sense_id: question.senseId,
      ...(row.state.modelVersion === 'frequency-v2-pilot-1'
        ? { segment_id: question.segmentId, band: question.band, quartile: question.quartile,
            item_id: question.senseId, operation_id: answer.operationId }
        : { level: question.level }),
      decision: answer.decision,
      correct: answer.decision === 'answer' ? answer.optionIndex === question.correctIndex : null,
      choice_index: answer.optionIndex,
      correct_index: question.correctIndex,
      elapsed_ms: answer.elapsedMs,
    }
  }))
  const replay = version.startsWith('va2-') ? rows.map(({ id, state }) => ({
    attempt_id: id, model: state.modelVersion, policy: state.policy, reference: state.referenceVersion,
    excluded: state.excluded, checkpoints: state.checkpoints, answered: state.answers.length,
    segments: state.segments.map(({ device: _device, ...log }) => ({
      ...log,
      questions: state.questions.slice(log.start, log.start + log.items.length).map(q => ({
        item_id: q.senseId, word: q.word, context: q.context, part_of_speech: q.partOfSpeech,
        options: q.options, correct_index: q.correctIndex,
      })),
    })),
  })) : undefined
  await writeFile(file, JSON.stringify({ version, answers, replay }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ attempts: rows.length, answers: answers.length }))
}

async function main() {
  const selected = [values.prepare, values.reviewed, values['trial-export']].filter(Boolean)
  if (selected.length > 1 || (values.apply && !values.reviewed) || (values.calibration && !values.reviewed) ||
      Boolean(values.version) !== Boolean(values['trial-export'])) {
    throw new Error('Use --prepare FILE, --reviewed FILE [--calibration FILE] [--apply], or --trial-export FILE --version BANK')
  }
  const db = database()
  if (values['trial-export']) return exportTrial(db, values.version, values['trial-export'])
  const source = await catalog(db)
  if (!values.reviewed) {
    if (values.prepare) await prepare(values.prepare, source)
    console.log(JSON.stringify(source.report, null, 2))
    return
  }

  const { counts, ready, version, itemsHash, content } = await createBank(values.reviewed, values.calibration, source)
  console.log(JSON.stringify({ counts, ready, version, itemsHash, calibrated: Boolean(content.calibration) }, null, 2))
  if (!values.apply) return
  if (!ready) throw new Error(`Review at least ${MIN_PER_LEVEL} unique main questions per level before publishing`)
  const { error } = await db.from(BANKS).insert({ version, content })
  if (error && error.code !== '23505') throw new Error(error.message)
  console.log(error ? 'This bank version already exists.' : 'Bank published.')
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
