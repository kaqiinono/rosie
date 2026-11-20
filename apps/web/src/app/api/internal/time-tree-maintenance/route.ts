import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabase, getBearerToken } from '@/lib/api-auth'
import { maintainTimeTree } from '@/lib/time-tree/maintenance'
import { dayOf, PRACTICE_SCHEDULE_VERSION, WEEKLY_SCHEDULE_VERSION } from '@/lib/time-tree/types'

export const maxDuration = 45
const batchSize = 4

function validSignature(token: string, secret: string) {
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!match) return false
  const [, issuedAt, signature] = match
  const age = Math.floor(Date.now() / 1000) - Number(issuedAt)
  if (age < -10 || age > 60) return false
  const expected = createHmac('sha256', secret).update(`time-tree-maintenance:${issuedAt}`).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

export async function POST(req: Request) {
  const secret = process.env.TIME_TREE_MAINTENANCE_SECRET
  const token = getBearerToken(req)
  if (!secret || !token || !validSignature(token, secret))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminSupabase()
  const today = dayOf(new Date())
  const deadline = Date.now() + 30_000
  let cursor: string | null = null
  let updated = 0
  let failed = 0
  let partial = false
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc('list_due_time_tree_owners', {
      p_today: today, p_weekly: WEEKLY_SCHEDULE_VERSION, p_practice: PRACTICE_SCHEDULE_VERSION,
      p_after: cursor, p_limit: batchSize,
    })
    if (error) {
      console.error('[time-tree-maintenance] list', error.code)
      return NextResponse.json({ error: 'list_failed', updated, failed }, { status: 503 })
    }

    const owners = data as { user_id: string }[]
    const results = await Promise.allSettled(owners.map(({ user_id }) => maintainTimeTree(db, user_id)))
    for (const result of results) {
      if (result.status === 'rejected') {
        failed += 1
        const code = typeof result.reason?.code === 'string' ? result.reason.code :
          result.reason?.message === 'tree_changed' ? 'tree_changed' : 'unknown_error'
        console.error('[time-tree-maintenance] owner', code)
      } else if (result.value) updated += 1
    }
    partial = owners.length === batchSize
    if (!partial) break
    cursor = owners[owners.length - 1].user_id
  }
  return NextResponse.json({ updated, failed, partial }, { status: failed ? 503 : 200 })
}
