#!/usr/bin/env node
/**
 * Sync Supabase structured tables into the RAG knowledge base.
 * - word_entries (english)
 * - chinese_char_entries
 * - chinese_lessons (titles + recall phrases)
 *
 * Requires: apps/web/.env.local + pnpm dev + AI_EMBED_*
 *
 * Usage:
 *   pnpm ai:sync-db
 *   pnpm ai:sync-db --tables=word_entries,chinese_char_entries,chinese_lessons
 *   pnpm ai:sync-db --limit=50
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(resolve(root, 'apps/web/.env.local'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appOrigin = process.env.AI_SYNC_ORIGIN ?? 'http://localhost:3000'
const ingestKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey || !ingestKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY（apps/web/.env.local）',
  )
  process.exit(1)
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const perTableLimit = limitArg ? Number(limitArg.split('=')[1]) : Infinity
const offsetArg = process.argv.find((a) => a.startsWith('--offset='))
const explicitOffset = offsetArg ? Number(offsetArg.split('=')[1]) : 0
const shouldResume = process.argv.includes('--resume')
const syncConcurrency = Math.max(1, Number(process.env.AI_SYNC_CONCURRENCY ?? 4))

const tablesArg = process.argv.find((a) => a.startsWith('--tables='))
const tables = tablesArg
  ? tablesArg
      .split('=')[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['word_entries', 'chinese_char_entries', 'chinese_lessons']

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--'
  const rounded = Math.ceil(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return minutes > 0 ? `${minutes}m${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

function createProgress(label, offset, batchTotal, sourceTotal) {
  const startedAt = Date.now()
  let processed = 0
  let lastPrinted = ''

  const print = (force = false) => {
    const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001)
    const rate = processed / elapsedSeconds
    const remaining = Math.max(batchTotal - processed, 0)
    const eta = rate > 0 ? formatDuration(remaining / rate) : '--'
    const overall = Math.min(offset + processed, sourceTotal)
    const percent = sourceTotal > 0 ? ((overall / sourceTotal) * 100).toFixed(1) : '100.0'
    const message =
      `  ${label}: ${overall}/${sourceTotal} (${percent}%)` +
      ` | 本批 ${processed}/${batchTotal}` +
      ` | ${rate.toFixed(1)} 条/秒 | ETA ${eta}`
    if (force || message !== lastPrinted) console.log(message)
    lastPrinted = message
  }

  print(true)
  const timer = setInterval(print, 1000)
  timer.unref()
  return {
    increment() {
      processed++
    },
    stop() {
      clearInterval(timer)
      print(true)
    },
  }
}

function chineseBookSlug(charKey) {
  const raw = String(charKey || '').split('::')[0]
  const aliases = {
    'g1-下': 'g1b',
    'g2-上': 'g2a',
    'g2-下': 'g2b',
  }
  return aliases[raw] ?? (['g1b', 'g2a', 'g2b'].includes(raw) ? raw : 'g1b')
}

async function mapWithConcurrency(items, worker) {
  let nextIndex = 0
  const workers = Array.from(
    { length: Math.min(syncConcurrency, Math.max(items.length, 1)) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        await worker(items[index], index)
      }
    },
  )
  await Promise.all(workers)
}

async function ingest(payload) {
  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res
    try {
      res = await fetch(`${appOrigin}/api/ai/knowledge/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-role-key': ingestKey,
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      if (attempt >= maxAttempts) throw error
      const waitMs = Math.min(30_000, 2000 * attempt)
      console.warn(`network error on ${payload.sourceRef}, retry ${attempt}/${maxAttempts}`)
      await sleep(waitMs)
      continue
    }
    if (res.ok) return res.json()

    const text = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      const waitMs = Math.min(30_000, 2000 * attempt)
      console.warn(
        `${res.status} on ${payload.sourceRef}, retry ${attempt}/${maxAttempts} in ${waitMs}ms`,
      )
      await sleep(waitMs)
      continue
    }
    throw new Error(`${payload.sourceRef}: ${res.status} ${text}`)
  }
}

async function updateSyncState(payload) {
  const now = new Date().toISOString()
  const terminal = payload.status === 'completed' || payload.status === 'failed'
  const { error } = await admin.from('knowledge_sync_state').upsert(
    {
      source_key: payload.sourceKey,
      status: payload.status,
      records_synced: payload.recordsSynced ?? 0,
      chunks_created: payload.chunksCreated ?? 0,
      chunks_deleted: payload.chunksDeleted ?? 0,
      cursor_position: payload.cursorPosition ?? 0,
      total_records: payload.totalRecords ?? null,
      error_msg: payload.errorMessage ?? null,
      metadata: payload.metadata ?? {},
      ...(payload.status === 'running' ? { started_at: now } : {}),
      completed_at: terminal ? now : null,
      ...(payload.status === 'completed' ? { last_synced_at: now } : {}),
      updated_at: now,
    },
    { onConflict: 'source_key' },
  )
  if (error) throw error
}

async function resolveOffset(sourceKey) {
  if (!shouldResume) return Number.isFinite(explicitOffset) ? Math.max(0, explicitOffset) : 0
  const { data, error } = await admin
    .from('knowledge_sync_state')
    .select('cursor_position')
    .eq('source_key', sourceKey)
    .maybeSingle()
  if (error) throw error
  return Math.max(0, Number(data?.cursor_position ?? 0))
}

async function countRows(table) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function fetchAll(table, select, startOffset, pageSize = 500) {
  const rows = []
  let from = startOffset
  while (rows.length < perTableLimit) {
    const remaining = Number.isFinite(perTableLimit) ? perTableLimit - rows.length : pageSize
    const to = from + Math.min(pageSize, remaining) - 1
    const { data, error } = await admin.from(table).select(select).range(from, to)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows.slice(0, Number.isFinite(perTableLimit) ? perTableLimit : undefined)
}

async function syncWords() {
  const sourceKey = 'english_words'
  const offset = await resolveOffset(sourceKey)
  const totalRecords = await countRows('word_entries')
  const data = await fetchAll(
    'word_entries',
    'id, word, ipa, chinese_def, explanation, example, unit, lesson, stage',
    offset,
  )
  await updateSyncState({
    sourceKey,
    status: 'running',
    cursorPosition: offset,
    totalRecords,
    metadata: { table: 'word_entries', subject: 'english' },
  })
  const manifestEntries = []
  let processed = 0
  const progress = createProgress('word_entries', offset, data.length, totalRecords)
  await mapWithConcurrency(data, async (row) => {
    const content = [
      `单词: ${row.word}`,
      row.ipa ? `音标: ${row.ipa}` : '',
      row.chinese_def ? `中文: ${row.chinese_def}` : '',
      row.explanation ? `英文释义: ${row.explanation}` : '',
      row.example ? `例句: ${row.example}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const sourceRef = `word_entries:${row.id}`
    await ingest({
      subject: 'english',
      sourceType: 'db_sync',
      sourceRef,
      title: row.word,
      content,
      metadata: {
        structured: true,
        word: row.word,
        unit: row.unit,
        lesson: row.lesson,
        stage: row.stage,
        href: `/english/words/practice?focus=${encodeURIComponent(row.word)}`,
      },
    })
    manifestEntries.push({
      sourceRef,
      href: `/english/words/practice?focus=${encodeURIComponent(row.word)}`,
      title: row.word,
      subject: 'english',
      wordKey: row.word,
    })
    processed++
    progress.increment()
  })
  progress.stop()
  mergeManifest('english', manifestEntries, (e) =>
    String(e.sourceRef || '').startsWith('word_entries:'),
  )
  const cursorPosition = offset + processed
  await updateSyncState({
    sourceKey,
    status: cursorPosition >= totalRecords ? 'completed' : 'partial',
    recordsSynced: cursorPosition,
    chunksCreated: processed,
    cursorPosition,
    totalRecords,
    metadata: { table: 'word_entries', subject: 'english' },
  })
  console.log(`word_entries synced: ${processed}`)
}

async function syncChineseChars() {
  const sourceKey = 'chinese_chars'
  const offset = await resolveOffset(sourceKey)
  const totalRecords = await countRows('chinese_char_entries')
  const data = await fetchAll(
    'chinese_char_entries',
    'char_key, char, pinyin, phrases, radical, radical_name, structure, stroke_count, grade, semester, tiers',
    offset,
  )
  await updateSyncState({
    sourceKey,
    status: 'running',
    cursorPosition: offset,
    totalRecords,
    metadata: { table: 'chinese_char_entries', subject: 'chinese' },
  })
  const manifestEntries = []
  let processed = 0
  const progress = createProgress('chinese_char_entries', offset, data.length, totalRecords)
  await mapWithConcurrency(data, async (row) => {
    const phrases = Array.isArray(row.phrases) ? row.phrases.filter(Boolean) : []
    const tiers = Array.isArray(row.tiers) ? row.tiers.filter(Boolean) : []
    const tierLabel = tiers.includes('write')
      ? '会写'
      : tiers.includes('recognize')
        ? '认读'
        : tiers.join(',')
    const content = [
      `汉字: ${row.char}`,
      row.pinyin ? `拼音: ${row.pinyin}` : '',
      row.radical ? `部首: ${row.radical}${row.radical_name ? `（${row.radical_name}）` : ''}` : '',
      row.structure ? `结构: ${row.structure}` : '',
      row.stroke_count != null ? `笔画: ${row.stroke_count}` : '',
      tierLabel ? `要求: ${tierLabel}` : '',
      row.grade != null ? `年级册: ${row.grade}${row.semester ?? ''}` : '',
      phrases.length ? `组词: ${phrases.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const sourceRef = `chinese_char_entries:${row.char_key}`
    const bookSlug = chineseBookSlug(row.char_key)

    await ingest({
      subject: 'chinese',
      sourceType: 'db_sync',
      sourceRef,
      title: row.char,
      content,
      metadata: {
        structured: true,
        char: row.char,
        charKey: row.char_key,
        tiers,
        grade: row.grade,
        semester: row.semester,
        href: `/chinese/${bookSlug}/chars`,
      },
    })
    manifestEntries.push({
      sourceRef,
      href: `/chinese/${bookSlug}/chars`,
      title: row.char,
      subject: 'chinese',
    })
    processed++
    progress.increment()
  })
  progress.stop()
  mergeManifest('chinese', manifestEntries, (e) =>
    String(e.sourceRef || '').startsWith('chinese_char_entries:'),
  )
  const cursorPosition = offset + processed
  await updateSyncState({
    sourceKey,
    status: cursorPosition >= totalRecords ? 'completed' : 'partial',
    recordsSynced: cursorPosition,
    chunksCreated: processed,
    cursorPosition,
    totalRecords,
    metadata: { table: 'chinese_char_entries', subject: 'chinese' },
  })
  console.log(`chinese_char_entries synced: ${processed}`)
}

function mergeManifest(subject, newEntries, _replacePredicate) {
  const manifestFile = resolve(root, 'packages/ai/src/data/link-manifest.json')
  let existing = []
  if (existsSync(manifestFile)) {
    try {
      existing = JSON.parse(readFileSync(manifestFile, 'utf8'))
      if (!Array.isArray(existing)) existing = []
    } catch {
      existing = []
    }
  }
  // Preserve rows outside the current batch so --limit/--resume cannot wipe
  // deep links created by earlier batches.
  const incomingRefs = new Set(newEntries.map((entry) => entry.sourceRef))
  const kept = existing.filter((entry) => !incomingRefs.has(entry.sourceRef))
  const deduped = Array.from(
    new Map([...kept, ...newEntries].map((e) => [e.sourceRef, e])).values(),
  ).sort((a, b) => String(a.sourceRef).localeCompare(String(b.sourceRef)))
  writeFileSync(manifestFile, `${JSON.stringify(deduped, null, 2)}\n`, 'utf8')
  console.log(
    `  link-manifest.json updated (${subject} db links: ${newEntries.length}, total: ${deduped.length})`,
  )
}

async function syncChineseLessons() {
  const sourceKey = 'chinese_lessons'
  const offset = await resolveOffset(sourceKey)
  const totalRecords = await countRows('chinese_lessons')
  const data = await fetchAll(
    'chinese_lessons',
    'lesson_key, lesson_title, unit, lesson, lesson_kind, grade, semester, recall_phrases',
    offset,
  )
  await updateSyncState({
    sourceKey,
    status: 'running',
    cursorPosition: offset,
    totalRecords,
    metadata: { table: 'chinese_lessons', subject: 'chinese' },
  })
  let processed = 0
  const progress = createProgress('chinese_lessons', offset, data.length, totalRecords)
  await mapWithConcurrency(data, async (row) => {
    const recalls = Array.isArray(row.recall_phrases) ? row.recall_phrases.filter(Boolean) : []
    const title = row.lesson_title || row.lesson_key
    const content = [
      `课题: ${title}`,
      row.lesson_key ? `课键: ${row.lesson_key}` : '',
      row.unit != null ? `单元: ${row.unit}` : '',
      row.lesson != null ? `课次: ${row.lesson}` : '',
      row.lesson_kind ? `课型: ${row.lesson_kind}` : '',
      row.grade != null ? `年级册: ${row.grade}${row.semester ?? ''}` : '',
      recalls.length ? `读一读记一记:\n${recalls.map((p) => `- ${p}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const bookSlug = String(row.lesson_key || '').includes('::')
      ? String(row.lesson_key).split('::')[0]
      : 'g1b'
    const localKey = String(row.lesson_key || '').includes('::')
      ? String(row.lesson_key).split('::').pop()
      : row.lesson_key

    await ingest({
      subject: 'chinese',
      sourceType: 'db_sync',
      sourceRef: `chinese_lessons:${row.lesson_key}`,
      title,
      content,
      metadata: {
        structured: true,
        lessonKey: row.lesson_key,
        bookSlug,
        localLessonKey: localKey,
        unit: row.unit,
        href: `/chinese/${bookSlug}/reading/${localKey}`,
      },
    })
    processed++
    progress.increment()
  })
  progress.stop()
  const cursorPosition = offset + processed
  await updateSyncState({
    sourceKey,
    status: cursorPosition >= totalRecords ? 'completed' : 'partial',
    recordsSynced: cursorPosition,
    chunksCreated: processed,
    cursorPosition,
    totalRecords,
    metadata: { table: 'chinese_lessons', subject: 'chinese' },
  })
  console.log(`chinese_lessons synced: ${processed}`)
}

console.log(`tables: ${tables.join(', ')}`)

for (const table of tables) {
  console.log(`\n=== ${table} ===`)
  try {
    if (table === 'word_entries') await syncWords()
    else if (table === 'chinese_char_entries') await syncChineseChars()
    else if (table === 'chinese_lessons') await syncChineseLessons()
    else console.warn(`unknown table skipped: ${table}`)
  } catch (err) {
    const sourceKey =
      table === 'word_entries'
        ? 'english_words'
        : table === 'chinese_char_entries'
          ? 'chinese_chars'
          : 'chinese_lessons'
    const message = err instanceof Error ? err.message : String(err)
    try {
      await updateSyncState({
        sourceKey,
        status: 'failed',
        cursorPosition: await resolveOffset(sourceKey),
        errorMessage: message,
        metadata: { table },
      })
    } catch (stateError) {
      console.error('failed to persist sync error:', stateError)
    }
    throw err
  }
}

console.log('\nDone.')
