import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { BAIDU_VIDEO_COOKIE, baiduMathVideoPath, fetchBaiduMathVideo } from '@/lib/baidu-math-video'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(req: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params
  if (!baiduMathVideoPath(key)) return failure('not_found', 404)
  const token = req.cookies.get(BAIDU_VIDEO_COOKIE)?.value
  if (!token) return failure('unauthorized', 401)
  const user = await getUserFromRequest(new Request(req.url, {
    headers: { Authorization: `Bearer ${token}` },
  }))
  if (!user) return failure('unauthorized', 401)
  const range = req.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return failure('invalid_range', 416)

  let upstream: Response | null
  try {
    upstream = await fetchBaiduMathVideo(key, range, req.signal)
  } catch {
    return failure('video_unavailable', 503)
  }
  if (!upstream) return failure('not_found', 404)
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'video/mp4',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
