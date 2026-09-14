#!/usr/bin/env node

/**
 * Conservative, resumable part-of-speech backfill for word_entries.
 *
 * Default mode never writes: it classifies only definitions with an
 * unambiguous leading pattern and exports everything else for human review.
 *
 * Usage:
 *   pnpm word-pos:backfill [--stage 5A] [--review scripts/word-pos-review.json]
 *   pnpm word-pos:backfill --apply --overrides scripts/word-pos-overrides.json
 *
 * The generated overrides file is keyed by row id. High-confidence suggestions
 * are prefilled as arrays such as ["n."], while uncertain rows are []. Review
 * and edit that file before using --apply.
 */

import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const requireFromCore = createRequire(new URL('../packages/core/package.json', import.meta.url))
const { createClient } = requireFromCore('@supabase/supabase-js')

const PAGE_SIZE = 500
const UPDATE_BATCH_SIZE = 100
const NETWORK_ATTEMPTS = 4

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(input, init) {
  let lastError
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      if (attempt === NETWORK_ATTEMPTS) break
      const waitMs = 1000 * 2 ** (attempt - 1)
      console.warn(`Network request failed; retrying in ${waitMs / 1000}s (${attempt}/${NETWORK_ATTEMPTS - 1})…`)
      await delay(waitMs)
    }
  }
  throw lastError
}

function parseArgs(argv) {
  const options = { apply: false, stage: null, review: 'scripts/word-pos-review.json', overrides: 'scripts/word-pos-overrides.json' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') options.apply = true
    else if (arg === '--stage') options.stage = argv[++i] ?? null
    else if (arg === '--review') options.review = argv[++i] ?? options.review
    else if (arg === '--overrides') options.overrides = argv[++i] ?? null
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: pnpm word-pos:backfill [--stage 5A] [--review path] [--overrides path] [--apply]')
      process.exit(0)
    } else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function classifyDefinition(definition) {
  const text = definition.trim().replace(/^[“"']|[”"']$/g, '')
  const lower = text.toLowerCase()
  if (/^to\s+[a-z]/.test(lower)) return { partOfSpeech: ['v.'], reason: 'definition starts with “to”' }
  if (/^(?:a|an|the)\s+[a-z]/.test(lower)) return { partOfSpeech: ['n.'], reason: 'definition starts with an article' }
  if (/^(?:having|relating to|used to describe|of or relating to)\b/.test(lower)) {
    return { partOfSpeech: ['adj.'], reason: 'definition uses an adjectival pattern' }
  }
  if (/^(?:in|at|on|from|with|without|before|after|between|among)\s/.test(lower)) {
    return { partOfSpeech: ['prep.'], reason: 'definition starts with a preposition' }
  }
  return null
}

async function readOverrides(path) {
  let parsed
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return {}
    throw error
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('--overrides must be a JSON object keyed by word_entries.id')
  }
  if (Array.isArray(parsed.proposed) || Array.isArray(parsed.review)) {
    const entries = [...(parsed.proposed ?? []), ...(parsed.review ?? [])]
    return Object.fromEntries(
      entries
        .filter((entry) => entry && typeof entry.id === 'string' && Array.isArray(entry.partOfSpeech))
        .map((entry) => [entry.id, entry.partOfSpeech]),
    )
  }
  for (const [id, value] of Object.entries(parsed)) {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim())) {
      throw new Error(`Invalid override for ${id}; expected a string array`)
    }
  }
  return parsed
}

async function loadRows(client, stage) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from('word_entries')
      .select('id, stage, unit, lesson, word, explanation, part_of_speech')
      .is('part_of_speech', null)
      .order('stage', { nullsFirst: true })
      .order('unit')
      .order('lesson')
      .range(from, from + PAGE_SIZE - 1)
    if (stage) query = query.eq('stage', stage)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithRetry },
  })
  if (options.apply) {
    const document = JSON.parse(await readFile(options.review, 'utf8'))
    const items = [...(document.proposed ?? []), ...(document.review ?? [])].filter(
      (item) => Array.isArray(item.partOfSpeech) && item.partOfSpeech.length > 0,
    )
    const groups = new Map()
    for (const item of items) {
      const key = JSON.stringify(item.partOfSpeech)
      const ids = groups.get(key) ?? []
      ids.push(item.id)
      groups.set(key, ids)
    }
    let updated = 0
    for (const [key, ids] of groups) {
      const partOfSpeech = JSON.parse(key)
      for (let start = 0; start < ids.length; start += UPDATE_BATCH_SIZE) {
        const batch = ids.slice(start, start + UPDATE_BATCH_SIZE)
        const { error } = await client
          .from('word_entries')
          .update({ part_of_speech: partOfSpeech })
          .in('id', batch)
          .is('part_of_speech', null)
        if (error) throw error
        updated += batch.length
      }
    }
    console.log(`Applied up to ${updated} reviewed entries from ${options.review}.`)
    return
  }
  const overrides = await readOverrides(options.overrides)
  const rows = await loadRows(client, options.stage)
  const proposed = []
  const review = []

  for (const row of rows) {
    const override = overrides[row.id]
    const inferred = classifyDefinition(row.explanation ?? '')
    if (override?.length) proposed.push({ ...row, partOfSpeech: override, source: 'override' })
    else if (inferred) proposed.push({ ...row, partOfSpeech: inferred.partOfSpeech, source: inferred.reason })
    else review.push({ id: row.id, stage: row.stage, unit: row.unit, lesson: row.lesson, word: row.word, explanation: row.explanation, reason: 'No unambiguous definition pattern; add an override after checking the source.' })
  }

  await mkdir(dirname(options.review), { recursive: true })
  await writeFile(options.review, `${JSON.stringify({ generatedAt: new Date().toISOString(), stage: options.stage, proposed, review }, null, 2)}\n`)
  const generatedOverrides = { generatedAt: new Date().toISOString(), stage: options.stage, proposed, review }
  await mkdir(dirname(options.overrides), { recursive: true })
  await writeFile(options.overrides, `${JSON.stringify(generatedOverrides, null, 2)}\n`)
  console.log(`Scanned ${rows.length}: ${proposed.length} proposed, ${review.length} require review.`)
  console.log(`Review file: ${options.review}`)
  console.log(`Overrides file: ${options.overrides}`)

  console.log('Dry run only. Review the readable review file, add partOfSpeech to uncertain entries, then rerun with --apply.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
