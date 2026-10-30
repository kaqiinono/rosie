import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { recomputeClaimedPlanningJobs } from '@/lib/task-planning-worker'
export const runtime = 'nodejs'
export async function POST(req: Request) {
  const secret = process.env.TASK_PLANNING_CRON_SECRET
  const supplied = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret ?? ''}`
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await recomputeClaimedPlanningJobs(10))
  } catch {
    return NextResponse.json({ error: 'planning_worker_unavailable' }, { status: 503 })
  }
}
