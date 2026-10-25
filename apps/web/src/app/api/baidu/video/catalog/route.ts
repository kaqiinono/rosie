import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { readMathVideoCatalog, validVideoLessonKey } from '@/lib/baidu-math-video-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request) {
  try {
    if (!await getUserFromRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
    const lessonKey = new URL(req.url).searchParams.get('lessonKey')
    if (!validVideoLessonKey(lessonKey)) return NextResponse.json({ error: 'invalid_lesson' }, { status: 400, headers })
    return NextResponse.json(await readMathVideoCatalog(lessonKey), { headers })
  } catch {
    return NextResponse.json({ error: 'catalog_unavailable' }, { status: 503, headers })
  }
}
