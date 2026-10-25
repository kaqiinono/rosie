import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { syncMathVideoCatalog, validVideoLessonKey } from '@/lib/baidu-math-video-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
    if (!isAdminRequestUser(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers })
    const body: unknown = await req.json().catch(() => null)
    const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    if (!validVideoLessonKey(input.lessonKey) || (input.force !== undefined && typeof input.force !== 'boolean')) {
      return NextResponse.json({ error: 'invalid_lesson' }, { status: 400, headers })
    }
    return NextResponse.json(await syncMathVideoCatalog(input.lessonKey, input.force === true), { headers })
  } catch (error) {
    if (error instanceof Error && error.message === 'baidu_search_incomplete') {
      return NextResponse.json({ error: 'search_incomplete' }, { status: 502, headers })
    }
    return NextResponse.json({ error: 'catalog_sync_failed' }, { status: 503, headers })
  }
}
