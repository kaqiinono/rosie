#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

loadEnv(resolve(import.meta.dirname, '../.env.local'))
const email = arg('--email', 'rosie@rosie.app')
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
  .select('id,title,status,new_words_per_day,updated_at')
  .eq('user_id', user.id)
  .order('updated_at', { ascending: false })
if (plansError) throw plansError

const report = []
for (const plan of plans ?? []) {
  const [{ data: rows, error: rowsError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      supabase
        .from('adaptive_plan_word_progress')
        .select('word_key,status,box_index,next_review_date,introduced_on,archived_at')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id),
      supabase
        .from('adaptive_practice_sessions')
        .select('practice_date,new_word_count,review_word_count,question_count,record_kind')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .order('practice_date', { ascending: true }),
    ])
  if (rowsError) throw rowsError
  if (sessionsError) throw sessionsError

  const activeRows = (rows ?? []).filter((row) => row.archived_at == null)
  const introducedButStillLanding = activeRows.filter(
    (row) =>
      row.introduced_on &&
      row.status === 'LEARNING' &&
      (row.box_index === 1 || row.box_index === 3) &&
      row.next_review_date === row.introduced_on,
  )
  report.push({
    plan: {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      newWordsPerDay: plan.new_words_per_day,
    },
    progress: {
      total: activeRows.length,
      introducedButNeverSettled: introducedButStillLanding.length,
      affectedDates: Object.groupBy(introducedButStillLanding, (row) => row.introduced_on),
    },
    sessions: {
      exact: (sessions ?? []).filter((row) => row.record_kind === 'exact'),
      inferred: (sessions ?? []).filter((row) => row.record_kind === 'inferred'),
    },
    recommendation:
      introducedButStillLanding.length > 0
        ? 'review_required: do not auto-advance from inferred history'
        : 'no landing-box anomaly detected',
  })
}

console.log(JSON.stringify({ email, generatedAt: new Date().toISOString(), report }, null, 2))
