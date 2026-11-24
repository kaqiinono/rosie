import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import { THEATER_MEDIA_COOKIE, THEATER_MEDIA_PATH, theaterError, theaterPrivateHeaders } from '@/lib/baidu-theater'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cookieOptions = (request: NextRequest) => ({
  httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict' as const,
  path: THEATER_MEDIA_PATH,
})

export async function POST(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token || !await getUserFromRequest(request)) return theaterError('登录已过期，请重新登录。', 401)
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp?: number }
  const maxAge = Math.min(3600, Math.floor((claims.exp ?? 0) - Date.now() / 1000))
  if (!Number.isFinite(maxAge) || maxAge <= 0) return theaterError('登录已过期，请重新登录。', 401)
  const response = new NextResponse(null, { status: 204, headers: theaterPrivateHeaders })
  response.cookies.set(THEATER_MEDIA_COOKIE, token, { ...cookieOptions(request), maxAge })
  return response
}

export async function DELETE(request: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers: theaterPrivateHeaders })
  response.cookies.set(THEATER_MEDIA_COOKIE, '', { ...cookieOptions(request), maxAge: 0 })
  return response
}
