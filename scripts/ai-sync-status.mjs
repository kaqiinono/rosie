#!/usr/bin/env node
/**
 * Count RAG knowledge_documents / chunks vs link-manifest.json
 * Usage: pnpm ai:sync-status
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
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
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
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

async function countExact(table) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function sampleByPrefix() {
  const { data, error } = await admin.from('knowledge_documents').select('subject, source_ref, source_type')
  if (error) throw error
  const bySubject = {}
  const byPrefix = {}
  for (const row of data ?? []) {
    bySubject[row.subject] = (bySubject[row.subject] || 0) + 1
    const prefix = String(row.source_ref || '').split(':')[0] || row.source_type || '?'
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1
  }
  return { bySubject, byPrefix, fetched: (data ?? []).length }
}

const docs = await countExact('knowledge_documents')
const chunks = await countExact('knowledge_chunks')
const { bySubject, byPrefix, fetched } = await sampleByPrefix()

console.log('=== knowledge DB（这才是知识库行数）===')
console.log({ documents: docs, chunks })
console.log('by subject:', bySubject)
console.log('by source_ref prefix:', byPrefix)
if (fetched < docs) {
  console.log(`(prefix 统计基于拉取的 ${fetched} 行；若超过默认页大小需分页，以 documents 总数为准)`)
}

const manifestPath = resolve(root, 'packages/ai/src/data/link-manifest.json')
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const mb = {}
  for (const e of m) mb[e.subject || '?'] = (mb[e.subject || '?'] || 0) + 1
  console.log('\n=== link-manifest.json（仅跳转表，不是全文库）===')
  console.log({ entries: m.length, bySubject: mb })
} else {
  console.log('\nlink-manifest.json missing')
}

console.log('\n期望量级参考：')
console.log('- word_entries ≈ 2000 → source_ref 前缀 word_entries')
console.log('- chinese_char_entries ≈ 600+ → chinese_char_entries')
console.log('- math SEA_POOL ≈ 1000+ → math')
console.log('- chinese catalog（课文/诗/积累/目录）≈ 几百 → chinese:* catalog')
console.log('\n若 documents << 4000：先 pnpm ai:sync-catalog，再 pnpm ai:sync-db')
