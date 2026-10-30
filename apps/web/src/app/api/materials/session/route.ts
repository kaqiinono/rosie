import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserFromRequest } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req),
    token = getBearerToken(req)
  if (!user || !token)
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    )
  const r = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  r.cookies.set('rosie_material_session', token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'strict',
    path: '/api/materials',
    maxAge: 3600,
  })
  return r
}
