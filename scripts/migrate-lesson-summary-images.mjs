#!/usr/bin/env node
/**
 * One-time migration: legacy lesson summary uploads (math_problem_images.image_kind = summary)
 * → rich-text rows in math_problem_notes (problem_id = {lessonId}__SUMMARY).
 *
 * Storage files under summaries/{lessonId}/summary.* are kept; body_html references the same URL.
 *
 * Usage (from repo root, with apps/web/.env.local):
 *   node scripts/migrate-lesson-summary-images.mjs
 *   node scripts/migrate-lesson-summary-images.mjs --delete-registry   # also remove summary image rows
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(resolve(root, 'apps/web/package.json'))
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
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL and key (SUPABASE_SERVICE_ROLE_KEY or ANON_KEY).',
  )
  process.exit(1)
}

const deleteRegistry = process.argv.includes('--delete-registry')
const supabase = createClient(url, key)

function publicImageUrl(storagePath) {
  return `${url}/storage/v1/object/public/math/${storagePath}`
}

function summaryBodyHtml(imageUrl) {
  return `<p><img src="${imageUrl}" alt="本讲内容总结" class="rich-inline-img"></p>`
}

async function main() {
  const { data: images, error } = await supabase
    .from('math_problem_images')
    .select('lesson_id, problem_id, storage_path, user_id, updated_at')
    .eq('image_kind', 'summary')
    .order('lesson_id')

  if (error) {
    console.error('Failed to load summary images:', error.message)
    process.exit(1)
  }

  if (!images?.length) {
    console.log('No legacy summary images to migrate.')
    return
  }

  let inserted = 0
  let skipped = 0
  let failed = 0
  const migratedKeys = []

  for (const row of images) {
    const { data: existing } = await supabase
      .from('math_problem_notes')
      .select('id')
      .eq('lesson_id', row.lesson_id)
      .eq('problem_id', row.problem_id)
      .limit(1)

    if (existing?.length) {
      console.log(`skip ${row.lesson_id} (note already exists)`)
      skipped++
      continue
    }

    const bodyHtml = summaryBodyHtml(publicImageUrl(row.storage_path))
    const { error: insertErr } = await supabase.from('math_problem_notes').insert({
      lesson_id: row.lesson_id,
      problem_id: row.problem_id,
      title: null,
      body_html: bodyHtml,
      sort_order: 0,
      user_id: row.user_id,
      updated_at: row.updated_at ?? new Date().toISOString(),
    })

    if (insertErr) {
      console.error(`fail ${row.lesson_id}:`, insertErr.message)
      failed++
      continue
    }

    console.log(`migrated ${row.lesson_id}`)
    inserted++
    migratedKeys.push({ lesson_id: row.lesson_id, problem_id: row.problem_id })
  }

  if (deleteRegistry && migratedKeys.length > 0) {
    for (const { lesson_id, problem_id } of migratedKeys) {
      await supabase
        .from('math_problem_images')
        .delete()
        .eq('lesson_id', lesson_id)
        .eq('problem_id', problem_id)
        .eq('image_kind', 'summary')
    }
    console.log(`Removed ${migratedKeys.length} math_problem_images summary row(s).`)
  }

  console.log(`Done. inserted=${inserted} skipped=${skipped} failed=${failed}`)
  if (inserted > 0 && !deleteRegistry) {
    console.log(
      'Optional cleanup: re-run with --delete-registry to drop legacy summary image rows (files stay in storage).',
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
