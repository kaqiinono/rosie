import { NextResponse } from 'next/server'
import { getBearerToken } from '@/lib/api-auth'
import { processTheaterSubtitleJob } from '@/lib/theater/subtitle-jobs'
import { normalizeTheaterOrigin, validTheaterCronRequest } from '@/lib/theater/subtitle-worker-auth'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const token = getBearerToken(request)
  const input = await request.json().catch(() => null)
  const origin = typeof input?.origin === 'string' ? normalizeTheaterOrigin(input.origin) : null
  if (!token || !origin || !validTheaterCronRequest(token, origin))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ processed: await processTheaterSubtitleJob(origin) })
  } catch {
    console.error('[theater-subtitle-worker] could not advance a job')
    return NextResponse.json({ error: 'worker_unavailable' }, { status: 503 })
  }
}
