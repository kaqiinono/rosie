import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
import { EXAM_MEDIA_COOKIE, EXAM_MEDIA_COOKIE_PATH } from '@/lib/exams/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' }
const cookie = (request: NextRequest) => ({ httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict' as const, path: EXAM_MEDIA_COOKIE_PATH })

export async function POST(request: NextRequest) {
  const token = getBearerToken(request)
  const user = await getUserFromRequest(request)
  if (!token || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
  let maxAge = 0
  try {
    const claims: unknown = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    if (claims && typeof claims === 'object' && 'exp' in claims && typeof claims.exp === 'number' && Number.isFinite(claims.exp)) {
      maxAge = Math.min(3600, Math.floor(claims.exp - Date.now() / 1000))
    }
  } catch { /* Only claims from the token already verified above set cookie lifetime. */ }
  if (maxAge <= 0) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
  const response = NextResponse.json({ expiresIn: maxAge }, { headers })
  response.cookies.set(EXAM_MEDIA_COOKIE, token, { ...cookie(request), maxAge })
  return response
}

export async function DELETE(request: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers })
  response.cookies.set(EXAM_MEDIA_COOKIE, '', { ...cookie(request), maxAge: 0 })
  return response
}
