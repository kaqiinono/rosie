#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    audit: { type: 'boolean' },
    'legacy-audit': { type: 'boolean' },
    apply: { type: 'boolean' },
    creator: { type: 'string' },
  },
})

function requireValue(value, message) {
  if (!value) throw new Error(message)
  return value
}

async function data(promise) {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
  return result.data
}

async function readAll(client, table, fields) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const page = await data(client.from(table).select(fields).order('id').range(offset, offset + 999))
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function audit(client) {
  const positions = await readAll(client, 'vocabulary_positions',
    'id,headword_id,standard_spelling,stage,unit,lesson,word,verified_sense_ids')
  const groups = new Map()
  for (const row of positions) {
    const group = groups.get(row.headword_id) ?? []
    group.push(row)
    groups.set(row.headword_id, group)
  }
  const overlap = [...groups.values()].filter((group) => new Set(group.map((row) => row.stage)).size > 1)
  return {
    positions: positions.length,
    headwords: groups.size,
    crossListHeadwords: overlap.length,
    ketPetHeadwords: overlap.filter((group) => ['KET', 'PET'].every((stage) => group.some((row) => row.stage === stage))).length,
    overlap,
    pendingSenseReview: positions.filter((row) => !row.verified_sense_ids.length),
  }
}

async function auditLegacy(client) {
  const positions = await readAll(client, 'word_entries', 'id,stage,unit,lesson,word,explanation,chinese_def,part_of_speech')
  const groups = new Map()
  for (const position of positions) {
    const cleaned = position.word.normalize('NFC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ')
    const surface = cleaned.replace(/\s*\((?:n\.|v\.|adj\.|adv\.|noun|verb|adjective|adverb|AmE [^()]+)\)$/i, '')
    const key = surface.toLowerCase().replace(/^color$/, 'colour')
    const group = groups.get(key) ?? []
    group.push(position)
    groups.set(key, group)
  }
  const matches = Array.from(groups, ([key, rows]) => ({ key, rows }))
    .filter(({ rows }) => rows.length > 1)
  return {
    positions: positions.length,
    candidateGroups: matches.length,
    ketPetCandidateGroups: matches.filter(({ rows }) => ['KET', 'PET'].every((stage) =>
      rows.some((row) => row.stage === stage),
    )).length,
    matches,
  }
}

async function main() {
  if ((values.audit || values['legacy-audit']) && (values.apply || values.input || (values.audit && values['legacy-audit']))) {
    throw new Error('Audit options run on their own')
  }
  const client = createClient(
    requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Missing NEXT_PUBLIC_SUPABASE_URL'),
    requireValue(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  if (values.audit) {
    console.log(JSON.stringify(await audit(client), null, 2))
    return
  }
  if (values['legacy-audit']) {
    console.log(JSON.stringify(await auditLegacy(client), null, 2))
    return
  }

  const rows = JSON.parse(await readFile(requireValue(values.input, 'Provide --input or --audit'), 'utf8'))
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected a nonempty array of reviewed vocabulary rows')
  const sourceRows = new Set()
  for (const row of rows) {
    if (!['key', 'revision', 'row'].every((key) => typeof row.source?.[key] === 'string' && row.source[key].trim())
      || (!row.position?.id && !['unit', 'lesson', 'word'].every((key) => typeof row.position?.[key] === 'string'))
      || !Array.isArray(row.senses) || !row.senses.length) {
      throw new Error('Each row needs source key, revision and row, a position, and one or more senses')
    }
    const key = JSON.stringify([row.source.key, row.source.revision, row.source.row])
    if (sourceRows.has(key)) throw new Error(`Duplicate source row ${key}`)
    sourceRows.add(key)
  }

  if (values.apply) {
    const creator = requireValue(values.creator, 'Explicit --apply requires --creator <administrator UUID>')
    const { user } = await data(client.auth.admin.getUserById(creator))
    if (user?.app_metadata?.role !== 'admin') throw new Error('--creator must be an administrator')
    if (rows.some((row) => row.reviewed !== true)) throw new Error('Apply requires reviewed: true on every row')
    let saved = 0
    for (const row of rows) {
      await data(client.rpc('publish_reviewed_vocabulary_position', {
        p_input: { ...row, position: { ...row.position, creator: user.id } },
      }))
      saved++
      if (saved % 50 === 0 || saved === rows.length) console.log(`Saved ${saved}/${rows.length}`)
    }
    return
  }

  const headwords = new Map()
  const report = []
  for (const row of rows) {
    const position = row.position.id
      ? await data(client.from('vocabulary_positions').select('headword_id,word').eq('id', row.position.id).maybeSingle())
      : null
    if (row.position.id && !position) {
      report.push({ source: row.source, action: 'review', reason: 'Missing active position' })
      continue
    }
    const word = position?.word ?? row.position.word
    if (!position && !headwords.has(word)) {
      headwords.set(word, await data(client.rpc('find_vocabulary_headword', { p_word: word })))
    }
    const headwordId = position?.headword_id ?? headwords.get(word)
    const existingSenses = headwordId
      ? await data(client.from('vocabulary_senses').select('id,written,verified,cefr').eq('headword_id', headwordId))
      : []
    const unknownReference = row.senses.some(({ senseId }) => senseId && !existingSenses.some((item) => item.id === senseId && item.verified))
    const ambiguous = row.reviewed !== true && (!headwordId || row.senses.some(({ senseId }) => !senseId))
    report.push({
      source: row.source,
      word,
      headwordId,
      action: unknownReference || ambiguous ? 'review'
        : !headwordId ? 'new_headword' : row.senses.some(({ senseId }) => !senseId) ? 'add_senses' : 'reuse',
      existingSenses,
    })
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
