import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import { BAIDU_AUDIO_COOKIE, BAIDU_AUDIO_COOKIE_PATH, listBaiduReadingKeys } from '@/lib/baidu-reading-audio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cookieOptions = (req: NextRequest) => ({
  httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict' as const,
  path: BAIDU_AUDIO_COOKIE_PATH,
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const keys = await listBaiduReadingKeys()
    const response = NextResponse.json({ keys }, { headers: { 'Cache-Control': 'private, no-store' } })
    // Restricted to audio routes; each stream validates this session with Supabase.
    response.cookies.set(BAIDU_AUDIO_COOKIE, token, { ...cookieOptions(req), maxAge: 3600 })
    return response
  } catch {
    return NextResponse.json({ error: 'baidu_unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}

export async function DELETE(req: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BAIDU_AUDIO_COOKIE, '', { ...cookieOptions(req), maxAge: 0 })
  return response
}
