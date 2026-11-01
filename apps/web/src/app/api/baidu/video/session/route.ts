import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import { BAIDU_VIDEO_COOKIE, BAIDU_VIDEO_COOKIE_PATH } from '@/lib/baidu-math-video'
import { getBaiduAccountContext } from '@/lib/baidu-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return NextResponse.json({ error: 'unauthorized' }, {
    status: 401, headers: { 'Cache-Control': 'private, no-store' },
  })
  // The video element cannot read a JSON error from its stream request.
  try {
    await getBaiduAccountContext()
  } catch (error) {
    const reauthorize = error instanceof Error && error.message === 'baidu_reauthorize'
    return NextResponse.json({ error: reauthorize ? 'baidu_reauthorize' : 'video_unavailable' }, {
      status: reauthorize ? 409 : 503, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
  response.cookies.set(BAIDU_VIDEO_COOKIE, token, {
    httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict',
    path: BAIDU_VIDEO_COOKIE_PATH, maxAge: 3600,
  })
  return response
}
