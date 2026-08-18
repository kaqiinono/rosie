import { NextResponse } from 'next/server'
import {
  createAdminSupabase,
  forbiddenResponse,
  requireAdminFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'

/**
 * Admin-only manual trigger for `compact_star_sessions` (migration 0023).
 * The RPC requires the service role (it aggregates + deletes rows across all
 * users), so it can only run server-side. The nightly pg_cron job does the
 * same work automatically; this endpoint is the on-demand escape hatch.
 */
export async function POST(req: Request) {
  const user = await requireAdminFromRequest(req)
  if (!user) {
    const authed = req.headers.get('authorization')
    return authed ? forbiddenResponse() : unauthorizedResponse()
  }

  let cooldownDays = 7
  try {
    const body = (await req.json()) as { cooldownDays?: unknown } | undefined
    const raw = Number(body?.cooldownDays)
    if (Number.isInteger(raw) && raw >= 1 && raw <= 90) cooldownDays = raw
  } catch {
    /* no body — use the default cooldown */
  }

  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.rpc('compact_star_sessions', {
      cooldown_days: cooldownDays,
    })
    if (error) {
      console.error('[stars/compact] RPC failed', error)
      return NextResponse.json({ error: 'compact_failed', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deleted: Number(data ?? 0) })
  } catch (err) {
    console.error('[stars/compact] unexpected error', err)
    return NextResponse.json({ error: 'compact_failed' }, { status: 500 })
  }
}
