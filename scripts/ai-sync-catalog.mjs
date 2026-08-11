#!/usr/bin/env node
/**
 * Sync TS catalog → RAG + link-manifest.json
 *
 * Default: chinese → english → math（数学按批，避免超时）
 *   pnpm ai:sync-catalog
 *
 *   pnpm ai:sync-catalog --subject=chinese
 *   pnpm ai:sync-catalog --subject=math --limit=80
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(resolve(root, 'apps/web/.env.local'))

const appOrigin = process.env.AI_SYNC_ORIGIN ?? 'http://localhost:3000'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const shouldResume = process.argv.includes('--resume')
const syncRunId = randomUUID()

if (!serviceKey || !supabaseUrl) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY（请写在 apps/web/.env.local）',
  )
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const subjectArg = process.argv.find((a) => a.startsWith('--subject='))
const subjects = subjectArg
  ? subjectArg
      .split('=')[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['chinese', 'english', 'math']

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const mathBatchSize = limitArg ? Number(limitArg.split('=')[1]) : 80

async function resolveMathOffset() {
  if (!shouldResume) return 0
  const { data, error } = await admin
    .from('knowledge_sync_state')
    .select('cursor_position')
    .eq('source_key', 'math_catalog')
    .maybeSingle()
  if (error) throw error
  return Math.max(0, Number(data?.cursor_position ?? 0))
}

async function postSubject(subject, { offset, limit } = {}) {
  const url = new URL('/api/ai/knowledge/sync-catalog', appOrigin)
  url.searchParams.set('subject', subject)
  if (offset != null) url.searchParams.set('offset', String(offset))
  if (limit != null) url.searchParams.set('limit', String(limit))
  console.log(`POST ${url}`)

  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res
    let polling = false
    let lastProgress = ''
    const printProgress = async () => {
      if (polling) return
      polling = true
      try {
        const { data } = await admin
          .from('knowledge_sync_state')
          .select('status,cursor_position,total_records')
          .eq('source_key', `${subject}_catalog`)
          .maybeSingle()
        const completed = Number(data?.cursor_position ?? offset ?? 0)
        const total = Number(data?.total_records ?? 0)
        if (data?.status === 'running' && total > 0) {
          const remaining = Math.max(total - completed, 0)
          const message = `  ${subject}: 已完成 ${completed}/${total} | 还差 ${remaining}`
          if (message !== lastProgress) console.log(message)
          lastProgress = message
        }
      } finally {
        polling = false
      }
    }
    const progressPoller = setInterval(printProgress, 1000)
    progressPoller.unref()
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-service-role-key': serviceKey,
          'x-rosie-sync-run-id': syncRunId,
        },
      })
    } catch (error) {
      clearInterval(progressPoller)
      if (attempt >= maxAttempts) throw error
      await new Promise((resolveWait) => setTimeout(resolveWait, Math.min(30_000, 2000 * attempt)))
      continue
    }
    clearInterval(progressPoller)
    await printProgress()
    const body = await res.json().catch(() => ({}))
    if (res.ok) return body
    if ((res.status === 409 || res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      const waitMs = Math.min(30_000, 2000 * attempt)
      console.warn(`${subject} ${res.status}, retry ${attempt}/${maxAttempts} in ${waitMs}ms`)
      await new Promise((resolveWait) => setTimeout(resolveWait, waitMs))
      continue
    }
    throw new Error(`${subject} failed: ${res.status} ${JSON.stringify(body)}`)
  }
  throw new Error(`${subject} retry limit exceeded`)
}

let failed = 0
const failureDetails = []

for (const subject of subjects) {
  console.log(`\n=== sync ${subject} ===`)
  try {
    if (subject === 'math') {
      let offset = await resolveMathOffset()
      let done = false
      let total = '?'
      while (!done) {
        const body = await postSubject('math', { offset, limit: mathBatchSize })
        console.log(JSON.stringify(body, null, 2))
        if (Array.isArray(body.errors) && body.errors.length) {
          failed += body.errors.length
          failureDetails.push(...body.errors)
        }
        const meta = body.math
        if (!meta) {
          console.warn('math response missing batch meta; stopping')
          break
        }
        total = meta.total
        done = Boolean(meta.done)
        offset = meta.offset + meta.limit
        console.log(`math progress: ${Math.min(offset, meta.total)} / ${total}`)
      }
    } else {
      const body = await postSubject(subject)
      console.log(JSON.stringify(body, null, 2))
      if (Array.isArray(body.errors) && body.errors.length) {
        failed += body.errors.length
        failureDetails.push(...body.errors)
      }
    }
  } catch (err) {
    failed++
    const message = err instanceof Error ? err.message : String(err)
    failureDetails.push({ subject, message })
    console.error(`${subject}: ${message}`)
    if (String(err).includes('fetch failed') || String(err).includes('ECONNREFUSED')) {
      console.error('提示：请先在另一个终端运行 pnpm dev')
    }
  }
}

console.log(`\nDone. ${failed > 0 ? `${failed} error(s).` : 'All subjects ok.'}`)
if (failureDetails.length > 0) {
  console.error('失败详情：')
  for (const failure of failureDetails) {
    console.error(`- ${failure.subject}: ${failure.message}`)
  }
}
console.log('提醒：英语词库 / 语文生字 在 knowledge 表里，需另跑: pnpm ai:sync-db')
console.log('统计真实灌库量: pnpm ai:sync-status')
if (failed > 0) process.exit(1)
