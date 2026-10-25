import { NextResponse } from 'next/server'
import { getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { readMathVideoSnapshot, validVideoLessonKey } from '@/lib/baidu-math-video-catalog'
import { buildMathVideoReport } from '@/lib/baidu-math-video-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
    if (!isAdminRequestUser(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers })
    const lessonKey = new URL(req.url).searchParams.get('lessonKey')
    if (!validVideoLessonKey(lessonKey)) return NextResponse.json({ error: 'invalid_lesson' }, { status: 400, headers })
    return NextResponse.json(buildMathVideoReport(await readMathVideoSnapshot(lessonKey)), { headers })
  } catch {
    return NextResponse.json({ error: 'catalog_report_unavailable' }, { status: 503, headers })
  }
}
