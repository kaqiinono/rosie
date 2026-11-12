import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromRequest } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: '请先登录。' }, { status: 401 })

  try {
    const db = createAdminSupabase()
    const [entries, states] = await Promise.all([
      db.from('draw_pool_entries')
        .select('id,name,kind,tree_ticket,accepted_round')
        .eq('user_id', user.id).order('name').order('id'),
      db.from('draw_pool_state')
        .select('kind,round_no,pending_id,ticket')
        .eq('user_id', user.id),
    ])
    if (entries.error) throw entries.error
    if (states.error) throw states.error

    const wheel = entries.data.map(entry => {
      const state = states.data.find(row => row.kind === entry.kind)
      return {
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        reserved: entry.tree_ticket != null,
        drawn: entry.kind === 'penalty' && entry.accepted_round >= (state?.round_no ?? 1),
        pending_ticket: state?.pending_id === entry.id ? state?.ticket : null,
      }
    })
    return NextResponse.json(wheel, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '暂时读不到奖惩池。' }, { status: 503 })
  }
}
