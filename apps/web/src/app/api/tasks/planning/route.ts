import { NextResponse } from 'next/server'
import {
  createAuthedSupabase,
  getBearerToken,
  getUserFromRequest,
  unauthorizedResponse,
} from '@/lib/api-auth'
import { recomputeOwnerPlanning } from '@/lib/task-planning-worker'
export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  const { data, error } = await createAuthedSupabase(getBearerToken(req)!).rpc(
    'task_planning_status',
  )
  return NextResponse.json(error ? { error: 'planning_read_failed' } : data, {
    status: error ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()
  const { error } = await createAuthedSupabase(getBearerToken(req)!).rpc('task_request_planning')
  if (error) return NextResponse.json({ error: 'planning_request_failed' }, { status: 503 })
  try {
    return NextResponse.json(await recomputeOwnerPlanning(user.id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'planning_worker_unavailable' }, { status: 503 })
  }
}
