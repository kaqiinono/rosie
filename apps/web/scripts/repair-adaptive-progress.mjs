#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function addOneDay(date) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + 1))
  return value.toISOString().slice(0, 10)
}

loadEnv(resolve(import.meta.dirname, '../.env.local'))
const email = arg('--email', 'rosie@rosie.app')
const apply = process.argv.includes('--apply')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (usersError) throw usersError
const user = users.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
if (!user) throw new Error(`User not found: ${email}`)

const { data: plans, error: plansError } = await supabase
  .from('adaptive_word_plans')
  .select('id,title,status')
  .eq('user_id', user.id)
  .eq('status', 'active')
if (plansError) throw plansError
if (!plans || plans.length !== 1)
  throw new Error(`Expected exactly one active plan, found ${plans?.length ?? 0}`)
const plan = plans[0]

const [
  { data: progress, error: progressError },
  { data: pending, error: pendingError },
  { data: sessions, error: sessionsError },
] = await Promise.all([
  supabase
    .from('adaptive_plan_word_progress')
    .select(
      'id,word_key,status,box_index,target_box,streak_wrong,next_review_date,introduced_on,archived_at,updated_at',
    )
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .eq('status', 'LEARNING')
    .eq('box_index', 1)
    .is('archived_at', null),
  supabase
    .from('practice_pending_sessions')
    .select('stash')
    .eq('user_id', user.id)
    .eq('kind', 'english_adaptive')
    .eq('scope_key', plan.id),
  supabase
    .from('adaptive_practice_sessions')
    .select('practice_date,question_count,record_kind')
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .gt('question_count', 0),
])
if (progressError) throw progressError
if (pendingError) throw pendingError
if (sessionsError) throw sessionsError

const landingRows = (progress ?? []).filter(
  (row) => row.introduced_on && row.next_review_date === row.introduced_on,
)
const keys = landingRows.map((row) => row.word_key)
const { data: mastery, error: masteryError } = await supabase
  .from('word_mastery')
  .select('word_key,review_history')
  .eq('user_id', user.id)
  .in('word_key', keys)
if (masteryError) throw masteryError

const blockedDates = new Set(
  (pending ?? []).flatMap((row) => {
    const date = row.stash?.date
    return typeof date === 'string' ? [date] : []
  }),
)
const masteryByKey = new Map((mastery ?? []).map((row) => [row.word_key, row]))
const evidencedSessionDates = new Set((sessions ?? []).map((row) => row.practice_date))
const repair = []
const skipped = []

for (const row of landingRows) {
  const history = masteryByKey.get(row.word_key)?.review_history
  const evidence = (Array.isArray(history) ? history : []).filter(
    (item) =>
      item &&
      typeof item.date === 'string' &&
      item.date >= row.introduced_on &&
      typeof item.correct === 'boolean',
  )
  const hasWrong = evidence.some((item) => !item.correct)
  const correctDates = evidence
    .filter((item) => item.correct && evidencedSessionDates.has(item.date))
    .map((item) => item.date)
  const reason = blockedDates.has(row.introduced_on)
    ? 'pending_snapshot_on_introduction_date'
    : correctDates.length === 0
      ? 'no_correct_evidence'
      : hasWrong
        ? 'mixed_outcomes_need_manual_review'
        : null

  if (reason) {
    skipped.push({ wordKey: row.word_key, introducedOn: row.introduced_on, reason })
    continue
  }
  const evidenceDate = correctDates.sort().at(-1)
  repair.push({
    before: row,
    evidenceDates: [...new Set(correctDates)].sort(),
    after: {
      box_index: 2,
      target_box: null,
      streak_wrong: 0,
      next_review_date: addOneDay(evidenceDate),
      updated_at: new Date().toISOString(),
    },
  })
}

const report = {
  mode: apply ? 'apply' : 'preview',
  email,
  plan: { id: plan.id, title: plan.title },
  landingCount: landingRows.length,
  repairCount: repair.length,
  skippedCount: skipped.length,
  blockedDates: [...blockedDates].sort(),
  evidencedSessionDates: [...evidencedSessionDates].sort(),
  repair,
  skipped,
}

if (!apply) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const backupPath = resolve(
  tmpdir(),
  `adaptive-progress-repair-${plan.id}-${new Date().toISOString().replaceAll(':', '-')}.json`,
)
writeFileSync(backupPath, JSON.stringify(report, null, 2), { flag: 'wx' })

const updated = []
for (const item of repair) {
  const { data, error } = await supabase
    .from('adaptive_plan_word_progress')
    .update(item.after)
    .eq('id', item.before.id)
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .eq('status', 'LEARNING')
    .eq('box_index', 1)
    .eq('next_review_date', item.before.next_review_date)
    .eq('introduced_on', item.before.introduced_on)
    .select('id,word_key,box_index,next_review_date,updated_at')
  if (error) throw error
  if (!data || data.length !== 1) {
    throw new Error(
      `Optimistic update rejected for ${item.before.word_key}; stop and inspect ${backupPath}`,
    )
  }
  updated.push(data[0])
}

console.log(
  JSON.stringify(
    {
      status: 'applied',
      backupPath,
      updatedCount: updated.length,
      updated,
      skipped,
    },
    null,
    2,
  ),
)
