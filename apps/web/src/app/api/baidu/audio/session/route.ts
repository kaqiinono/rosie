import { baiduAuthErrorCode } from '@rosie/core'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import {
  BAIDU_AUDIO_COOKIE,
  BAIDU_AUDIO_COOKIE_PATH,
  listBaiduReadingKeys,
} from '@/lib/baidu-reading-audio'

import { listEnglishAudioSlots } from '@/lib/baidu-english-audio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cookieOptions = (req: NextRequest) => ({
  httpOnly: true,
  secure: req.nextUrl.protocol === 'https:',
  sameSite: 'strict' as const,
  path: BAIDU_AUDIO_COOKIE_PATH,
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const token = getBearerToken(req)
  if (!user || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const [legacy, bindings] = await Promise.allSettled([
      listBaiduReadingKeys(),
      listEnglishAudioSlots(),
    ])
    if (legacy.status === 'rejected' && (bindings.status === 'rejected' || !bindings.value.length))
      throw legacy.reason
    const keys = [
      ...(legacy.status === 'fulfilled' ? legacy.value : []),
      ...(bindings.status === 'fulfilled' ? bindings.value : []),
    ]
    const response = NextResponse.json(
      { keys },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
    // Restricted to audio routes; each stream validates this session with Supabase.
    response.cookies.set(BAIDU_AUDIO_COOKIE, token, { ...cookieOptions(req), maxAge: 3600 })
    return response
  } catch (error) {
    const code = baiduAuthErrorCode(error)
    const response = NextResponse.json(
      { error: code ?? 'baidu_unavailable' },
      {
        status: code ? 409 : 503,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
    // Keep playback/fallback and listening clips able to report their own errors.
    response.cookies.set(BAIDU_AUDIO_COOKIE, token, { ...cookieOptions(req), maxAge: 3600 })
    return response
  }
}

export async function DELETE(req: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BAIDU_AUDIO_COOKIE, '', { ...cookieOptions(req), maxAge: 0 })
  return response
}
