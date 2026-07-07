#!/usr/bin/env node
/**
 * Math 讲次 ID 迁移 — JSON 字段 + Storage 对象 + 审计报告
 *
 * 简单列（problem_id / lesson_id）优先用 docs/sql/math-lesson-id-migrate.sql。
 * 本脚本处理：
 *   - math_problem_notes.body_html 内嵌图片 URL
 *   - Supabase Storage math bucket 目录复制（--storage）
 *
 * 组卷、周计划、复习状态不迁移 — 迁移前用 docs/sql/math-lesson-id-delete-disposable.sql 清空。
 *
 * Usage（repo root，需 apps/web/.env.local）：
 *   node scripts/migrate-math-lesson-ids.mjs              # 审计 / dry-run
 *   node scripts/migrate-math-lesson-ids.mjs --apply      # 写 JSON 列
 *   node scripts/migrate-math-lesson-ids.mjs --apply --storage  # 含 Storage
 *
 * 需要 SUPABASE_SERVICE_ROLE_KEY（Storage 复制必需）或 ANON_KEY（仅 JSON 读写）。
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(resolve(root, 'apps/web/package.json'))
const { createClient } = require('@supabase/supabase-js')

/** @type {{ legacyId: string; lessonKey: string }[]} */
const LESSON_MAP = [
  { legacyId: '12', lessonKey: '1-12' },
  { legacyId: '13', lessonKey: '1-13' },
  { legacyId: '15', lessonKey: '1-15' },
  { legacyId: '18', lessonKey: '1-18' },
  { legacyId: '23', lessonKey: '1-23' },
  { legacyId: '29', lessonKey: '1-29' },
  { legacyId: '30', lessonKey: '1-30' },
  { legacyId: '34', lessonKey: '1-34' },
  { legacyId: '35', lessonKey: '1-35' },
  { legacyId: '36', lessonKey: '1-36' },
  { legacyId: '37', lessonKey: '1-37' },
  { legacyId: '38', lessonKey: '1-38' },
  { legacyId: '39', lessonKey: '1-39' },
  { legacyId: '40', lessonKey: '1-40' },
  { legacyId: '41', lessonKey: '1-41' },
  { legacyId: '42', lessonKey: '1-42' },
  { legacyId: '43', lessonKey: '1-43' },
  { legacyId: '44', lessonKey: '1-44' },
  { legacyId: '46', lessonKey: '1-46' },
  { legacyId: '47', lessonKey: '1-47' },
  { legacyId: '49', lessonKey: '2-1' },
  { legacyId: '50', lessonKey: '2-2' },
  { legacyId: '51', lessonKey: '2-3' },
  { legacyId: '52', lessonKey: '2-4' },
  { legacyId: '53', lessonKey: '2-5' },
  { legacyId: '55', lessonKey: '2-6' },
]

const LEGACY_TO_KEY = Object.fromEntries(LESSON_MAP.map((e) => [e.legacyId, e.lessonKey]))
const MATH_BUCKET = 'math'

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
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in apps/web/.env.local')
  process.exit(1)
}

const apply = process.argv.includes('--apply')
const migrateStorage = process.argv.includes('--storage')
const supabase = createClient(url, key)

function migrateLessonId(id) {
  if (typeof id !== 'string') return id
  return LEGACY_TO_KEY[id] ?? id
}

function migrateProblemId(problemId) {
  if (typeof problemId !== 'string') return problemId
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    const key = LEGACY_TO_KEY[prefix]
    return key ? `${key}__SUMMARY` : problemId
  }
  for (const { legacyId, lessonKey } of [...LESSON_MAP].sort(
    (a, b) => b.legacyId.length - a.legacyId.length,
  )) {
    if (problemId.startsWith(`${legacyId}-`)) {
      return lessonKey + problemId.slice(legacyId.length)
    }
  }
  return problemId
}

function migrateBodyHtml(html) {
  if (typeof html !== 'string') return html
  let out = html
  for (const { legacyId, lessonKey } of LESSON_MAP) {
    const patterns = [
      `summaries/${legacyId}/`,
      `notes/${legacyId}/`,
      `drafts/${legacyId}/`,
      `analysis/${legacyId}/`,
      `figures/${legacyId}/`,
    ]
    for (const p of patterns) {
      out = out.split(p).join(p.replace(`/${legacyId}/`, `/${lessonKey}/`))
    }
  }
  return out
}

async function tableExists(table) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (!error) return true
  if (error.code === '42P01' || error.message?.includes('does not exist')) return false
  throw error
}

async function audit() {
  console.log('=== Math lesson ID migration audit (dry-run) ===\n')

  const tables = [
    'math_solved',
    'math_wrong',
    'math_favorites',
    'math_weekly_plans',
    'math_quiz_papers',
    'math_rotating_review',
    'math_weekly_lesson_review',
    'math_problem_notes',
    'math_problem_images',
    'math_scratch_drafts',
    'math_practice_attempts',
    'math_scratch_working',
    'math_quiz_scratch_links',
  ]

  for (const table of tables) {
    const exists = await tableExists(table)
    if (!exists) {
      console.log(`${table}: (table not in database — skipped)`)
      continue
    }
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    console.log(`${table}: ${error ? `error ${error.message}` : `${count ?? 0} rows`}`)
  }

  const { data: solvedSample } = await supabase
    .from('math_solved')
    .select('problem_id')
    .limit(5)
  console.log('\nmath_solved sample:', solvedSample?.map((r) => r.problem_id))

  const { data: plans } = await supabase
    .from('math_weekly_plans')
    .select('id, lesson_id, week_start')
  console.log(`\nmath_weekly_plans: ${plans?.length ?? 0} rows`)
  for (const p of plans ?? []) {
    console.log(`  week ${p.week_start} lesson_id=${p.lesson_id}`)
  }

  console.log('\nRun docs/sql/math-lesson-id-audit.sql in Supabase for detailed breakdown.')
  console.log('Apply order:')
  console.log('  1. Backup')
  console.log('  2. docs/sql/math-lesson-id-delete-disposable.sql (组卷 + 计划清空)')
  console.log('  3. docs/sql/math-lesson-id-migrate.sql (transaction)')
  console.log('  4. node scripts/migrate-math-lesson-ids.mjs --apply')
  console.log('  5. node scripts/migrate-math-lesson-ids.mjs --apply --storage')
}

async function assertDisposableTablesEmpty() {
  const tables = [
    'math_quiz_papers',
    'math_quiz_scratch_links',
    'math_weekly_plans',
    'math_rotating_review',
    'math_weekly_lesson_review',
  ]
  for (const table of tables) {
    if (!(await tableExists(table))) continue
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) throw error
    if ((count ?? 0) > 0) {
      console.warn(
        `${table}: skipped (${count} rows — run docs/sql/math-lesson-id-delete-disposable.sql first)`,
      )
    } else {
      console.log(`${table}: empty (ok)`)
    }
  }
}

async function migrateJson() {
  await assertDisposableTablesEmpty()

  const { data: notes } = await supabase
    .from('math_problem_notes')
    .select('id, body_html')
    .not('body_html', 'is', null)
  let noteN = 0
  for (const row of notes ?? []) {
    const body_html = migrateBodyHtml(row.body_html)
    if (body_html !== row.body_html) {
      const { error } = await supabase
        .from('math_problem_notes')
        .update({ body_html, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      noteN++
    }
  }
  console.log(`math_problem_notes body_html: updated ${noteN} rows`)
}

async function listStoragePrefix(prefix) {
  const { data, error } = await supabase.storage.from(MATH_BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  return data ?? []
}

async function migrateStorageObjects() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('--storage requires SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const folders = ['analysis', 'figures', 'summaries', 'notes', 'drafts']
  let copied = 0

  for (const { legacyId, lessonKey } of LESSON_MAP) {
    for (const folder of folders) {
      const oldPrefix = `${folder}/${legacyId}`
      const newPrefix = `${folder}/${lessonKey}`

      async function walk(prefix, destPrefix) {
        const entries = await listStoragePrefix(prefix)
        for (const entry of entries) {
          const path = `${prefix}/${entry.name}`
          const destPath = `${destPrefix}/${entry.name}`
          if (entry.id === null) {
            await walk(path, destPath)
            continue
          }
          const { data: blob, error: dlErr } = await supabase.storage
            .from(MATH_BUCKET)
            .download(path)
          if (dlErr) {
            console.warn(`skip download ${path}:`, dlErr.message)
            continue
          }
          const { error: upErr } = await supabase.storage
            .from(MATH_BUCKET)
            .upload(destPath, blob, { upsert: true })
          if (upErr) {
            console.warn(`skip upload ${destPath}:`, upErr.message)
            continue
          }
          copied++
          console.log(`copied ${path} → ${destPath}`)
        }
      }

      try {
        await walk(oldPrefix, newPrefix)
      } catch (e) {
        if (e?.message?.includes('not found')) continue
        throw e
      }
    }
  }

  console.log(`\nStorage: copied ${copied} objects (old paths kept for rollback)`)
}

async function main() {
  if (!apply) {
    await audit()
    return
  }

  console.log('=== Applying JSON migration ===')
  await migrateJson()

  if (migrateStorage) {
    console.log('\n=== Migrating Storage ===')
    await migrateStorageObjects()
  }

  console.log('\nDone. Re-run audit SQL to verify zero legacy IDs remain.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
