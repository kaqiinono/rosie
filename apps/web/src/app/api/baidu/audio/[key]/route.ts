import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { baiduReadingPath, BAIDU_AUDIO_COOKIE, fetchBaiduReadingAudio } from '@/lib/baidu-reading-audio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(req: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params
  if (!baiduReadingPath(key)) return failure('not_found', 404)
  const token = req.cookies.get(BAIDU_AUDIO_COOKIE)?.value
  if (!token) return failure('unauthorized', 401)
  const user = await getUserFromRequest(new Request(req.url, {
    headers: { Authorization: `Bearer ${token}` },
  }))
  if (!user) return failure('unauthorized', 401)
  const range = req.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return failure('invalid_range', 416)

  let upstream: Response | null = null
  try {
    upstream = await fetchBaiduReadingAudio(key, range, req.signal)
  } catch {
    // Missing authorization, revoked tokens and upstream failures keep Storage usable.
  }
  if (!upstream) {
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!origin) return failure('audio_unavailable', 503)
    const url = new URL(`/storage/v1/object/public/reading/passages/${encodeURIComponent(key)}/narration.mp3`, origin)
    try {
      upstream = await fetch(url, {
        headers: range ? { Range: range, 'Accept-Encoding': 'identity' } : { 'Accept-Encoding': 'identity' },
        cache: 'no-store', redirect: 'error',
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(120_000)]),
      })
    } catch {
      return failure('audio_unavailable', 503)
    }
  }
  if (![200, 206, 416].includes(upstream.status)) {
    await upstream.body?.cancel()
    return failure('audio_unavailable', upstream.status === 404 ? 404 : 503)
  }
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'audio/mpeg',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
