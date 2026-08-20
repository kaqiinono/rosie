#!/usr/bin/env node
/**
 * Unattended full RAG sync with resumable batches.
 *
 * Usage:
 *   pnpm ai:sync-all
 *   pnpm ai:sync-all --batch=200 --concurrency=8
 *   pnpm ai:sync-all --batch=200 --math-batch=40 --concurrency=8
 *   pnpm ai:sync-all --skip-catalog
 *
 * This is "offline" in the sense that it runs without an AI coding session.
 * It still needs network access to Supabase and the configured embedding API.
 */
import { spawn } from 'node:child_process'
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

function numberArg(name, fallback) {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`))
  const parsed = arg ? Number(arg.split('=')[1]) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

loadEnvFile(resolve(root, 'apps/web/.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const embedKey = process.env.AI_EMBED_API_KEY
if (!supabaseUrl || !serviceKey || !embedKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or AI_EMBED_API_KEY')
  process.exit(1)
}

const batchSize = numberArg('batch', 200)
const mathBatchSize = numberArg('math-batch', 40)
const concurrency = numberArg('concurrency', 8)
const port = numberArg('port', 3000)
const origin = process.env.AI_SYNC_ORIGIN ?? `http://localhost:${port}`
const skipCatalog = process.argv.includes('--skip-catalog')
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let ownedServer = null

function run(command, args, extraEnv = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}

async function serverIsReady() {
  try {
    const response = await fetch(`${origin}/api/ai/knowledge/status`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.status > 0
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await serverIsReady()) {
    console.log(`Using existing web server: ${origin}`)
    return
  }

  console.log(`Starting temporary web server: ${origin}`)
  ownedServer = spawn('pnpm', ['--filter', 'web', 'dev', '--port', String(port)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
    if (await serverIsReady()) return
    if (ownedServer.exitCode != null) throw new Error('temporary_web_server_exited')
  }
  throw new Error('temporary_web_server_timeout')
}

async function dbSourcesComplete() {
  const expected = new Set(['english_words', 'chinese_chars', 'chinese_lessons', 'english_grammar'])
  const { data, error } = await admin
    .from('knowledge_sync_state')
    .select('source_key,status,cursor_position,total_records')
    .in('source_key', [...expected])
  if (error) throw error
  const rows = data ?? []
  console.table(rows)
  return [...expected].every((sourceKey) => {
    const row = rows.find((candidate) => candidate.source_key === sourceKey)
    return row?.status === 'completed' && row.cursor_position >= row.total_records
  })
}

async function syncDatabaseSources() {
  let batches = 0
  while (!(await dbSourcesComplete())) {
    batches++
    if (batches > 1000) throw new Error('database_sync_batch_limit_exceeded')
    console.log(`\n=== DB batch ${batches} (${batchSize} rows/source) ===`)
    await run(
      process.execPath,
      [resolve(root, 'scripts/ai-sync-db.mjs'), `--limit=${batchSize}`, '--resume'],
      {
        AI_SYNC_ORIGIN: origin,
        AI_SYNC_CONCURRENCY: String(concurrency),
      },
    )
  }
}

function cleanup() {
  if (ownedServer && ownedServer.exitCode == null) ownedServer.kill('SIGTERM')
}
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

try {
  await ensureServer()

  if (!skipCatalog) {
    console.log('\n=== Refresh Chinese and English catalogs ===')
    await run(
      process.execPath,
      [resolve(root, 'scripts/ai-sync-catalog.mjs'), '--subject=chinese,english'],
      { AI_SYNC_ORIGIN: origin },
    )
  }

  await syncDatabaseSources()

  if (!skipCatalog) {
    console.log('\n=== Resume full math catalog ===')
    await run(
      process.execPath,
      [
        resolve(root, 'scripts/ai-sync-catalog.mjs'),
        '--subject=math',
        `--limit=${mathBatchSize}`,
        '--resume',
      ],
      { AI_SYNC_ORIGIN: origin },
    )
  }

  console.log('\n=== Final audit ===')
  await run(process.execPath, [resolve(root, 'scripts/ai-audit.mjs')])
  console.log('\nFull knowledge sync completed successfully.')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nFull knowledge sync failed: ${message}`)
  process.exitCode = 1
} finally {
  cleanup()
}
