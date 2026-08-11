#!/usr/bin/env node
/**
 * Read-only RAG completeness audit.
 * Usage: pnpm ai:audit
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'packages/core/package.json'))
const { createClient } = require('@supabase/supabase-js')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(root, 'apps/web/.env.local'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env in apps/web/.env.local')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function exactCount(table, apply = (query) => query) {
  const query = apply(admin.from(table).select('*', { count: 'exact', head: true }))
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

const sourceChecks = [
  { source: 'english_words', table: 'word_entries', subject: 'english', prefix: 'word_entries:%' },
  {
    source: 'chinese_chars',
    table: 'chinese_char_entries',
    subject: 'chinese',
    prefix: 'chinese_char_entries:%',
  },
  {
    source: 'chinese_lessons',
    table: 'chinese_lessons',
    subject: 'chinese',
    prefix: 'chinese_lessons:%',
  },
]

const rows = []
let failed = false
for (const check of sourceChecks) {
  const expected = await exactCount(check.table)
  const actual = await exactCount('knowledge_documents', (query) =>
    query.eq('subject', check.subject).like('source_ref', check.prefix),
  )
  const pass = actual === expected
  failed ||= !pass
  rows.push({
    source: check.source,
    expected,
    actual,
    coverage: expected ? `${((actual / expected) * 100).toFixed(1)}%` : '100%',
    result: pass ? 'PASS' : 'FAIL',
  })
}

for (const subject of ['english', 'chinese', 'math']) {
  const documents = await exactCount('knowledge_documents', (query) => query.eq('subject', subject))
  const chunks = await exactCount('knowledge_chunks', (query) => query.eq('subject', subject))
  const missingEmbeddings = await exactCount('knowledge_chunks', (query) =>
    query.eq('subject', subject).is('embedding', null),
  )
  const pass = documents > 0 && chunks > 0 && missingEmbeddings === 0
  failed ||= !pass
  rows.push({
    source: `${subject}_all`,
    expected: '>0',
    actual: documents,
    coverage: `${chunks} chunks / ${missingEmbeddings} missing vectors`,
    result: pass ? 'PASS' : 'FAIL',
  })
}

const { data: states, error: statesError } = await admin
  .from('knowledge_sync_state')
  .select('source_key,status,cursor_position,total_records,last_synced_at,error_msg')
  .order('source_key')
if (statesError) throw statesError

console.log('=== RAG completeness ===')
console.table(rows)
console.log('\n=== Sync state ===')
console.table(states ?? [])

const failedStates = (states ?? []).filter((state) => state.status === 'failed')
if (failedStates.length > 0) failed = true

if (failed) {
  console.error('\nRAG audit failed. Complete or repair the failing sources before full rollout.')
  process.exit(1)
}
console.log('\nRAG audit passed.')
