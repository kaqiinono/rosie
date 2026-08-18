#!/usr/bin/env node
/**
 * Read-only diagnosis: why does the /today adaptive-English card show
 * "20/25 · 5 remaining" after a full practice round?
 * Usage: node scripts/diagnose-adaptive-today.mjs [YYYY-MM-DD]
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

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const supabase = createClient(url, key)

async function main() {
  const { data: plans, error: planErr } = await supabase
    .from('adaptive_word_plans')
    .select('id,user_id,title,status,mode,new_words_per_day,review_cap,created_at')
    .is('archived_at', null)
  if (planErr) throw planErr
  console.log(`\n== adaptive_word_plans (not archived) ==`)
  console.table(plans)

  const active = (plans ?? []).filter((p) => p.status === 'active')
  for (const plan of active) {
    console.log(`\n== adaptive_daily_progress for plan ${plan.id} around ${date} ==`)
    const { data: daily, error: dailyErr } = await supabase
      .from('adaptive_daily_progress')
      .select('*')
      .eq('plan_id', plan.id)
      .gte('practice_date', date)
      .lte('practice_date', date)
    if (dailyErr) throw dailyErr
    console.table(daily)

    console.log(`\n== adaptive_practice_sessions for ${date} ==`)
    const { data: sessions, error: sessErr } = await supabase
      .from('adaptive_practice_sessions')
      .select(
        'id,practice_date,mode,started_at,finished_at,new_word_count,review_word_count,question_count,correct_count,stars_earned,boss_passed',
      )
      .eq('plan_id', plan.id)
      .eq('practice_date', date)
      .order('started_at')
    if (sessErr) throw sessErr
    console.table(sessions)

    console.log(`\n== word progress status tally (plan ${plan.id}) ==`)
    const { data: rows, error: rowErr } = await supabase
      .from('adaptive_plan_word_progress')
      .select(
        'word_key,status,box_index,target_box,streak_wrong,next_review_date,introduced_on,archived_at',
      )
      .eq('plan_id', plan.id)
    if (rowErr) throw rowErr
    const live = (rows ?? []).filter((r) => !r.archived_at)
    const tally = {}
    for (const r of live) tally[r.status] = (tally[r.status] ?? 0) + 1
    console.log('total live rows:', live.length, 'tally:', tally)

    const introducedToday = live.filter((r) => r.introduced_on === date)
    console.log('\nintroduced today:', introducedToday.length)
    const unfinished = introducedToday.filter(
      (r) =>
        r.status === 'LEARNING' &&
        r.streak_wrong === 0 &&
        (r.box_index === 1 || r.box_index === 3),
    )
    console.log('unfinished same-day activations (streakWrong=0, box1/3):', unfinished.length)
    if (unfinished.length > 0) console.table(unfinished)

    const dueToday = live.filter(
      (r) => r.status === 'LEARNING' && r.next_review_date != null && r.next_review_date <= date,
    )
    console.log('\ndue LEARNING rows (next_review_date <= today):', dueToday.length)
    if (dueToday.length > 0 && dueToday.length <= 30) console.table(dueToday)

    const notStarted = live.filter((r) => r.status === 'NOT_STARTED').length
    const pending = live.filter((r) => r.status === 'LEARNING_PENDING').length
    console.log(`pool for new activations: NOT_STARTED=${notStarted}, LEARNING_PENDING=${pending}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
