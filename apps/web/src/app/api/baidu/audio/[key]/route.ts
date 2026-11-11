import { baiduAuthErrorCode } from '@rosie/core'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import {
  baiduReadingPath,
  BAIDU_AUDIO_COOKIE,
  fetchBaiduReadingAudio,
} from '@/lib/baidu-reading-audio'

import { fetchEnglishAudio } from '@/lib/baidu-english-audio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(req: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params
  const clip = req.nextUrl.searchParams.get('clip')
  const asset = req.nextUrl.searchParams.get('asset')
  if (
    asset !== null &&
    (!/^[a-z0-9]+-u\d+l\d+$/.test(key) || !asset || asset.length > 512 || clip !== null)
  )
    return failure('not_found', 404)
  if (asset === null && !baiduReadingPath(key, clip)) return failure('not_found', 404)
  const token = req.cookies.get(BAIDU_AUDIO_COOKIE)?.value
  if (!token) return failure('unauthorized', 401)
  const user = await getUserFromRequest(
    new Request(req.url, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )
  if (!user) return failure('unauthorized', 401)
  const range = req.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return failure('invalid_range', 416)

  let upstream: Response | null = null
  let authError: string | null = null
  const unavailable = (status = 503) =>
    failure(authError ?? 'audio_unavailable', authError ? 409 : status)
  try {
    upstream =
      asset === null
        ? await fetchBaiduReadingAudio(key, range, req.signal, clip)
        : await fetchEnglishAudio(key, asset, range, req.signal)
    if (asset !== null && !upstream) return failure('audio_not_found', 404)
  } catch (error) {
    authError = baiduAuthErrorCode(error)
    if (asset !== null) return unavailable()
    // Preserve Storage fallback; report authorization only if fallback also fails.
  }
  if (!upstream && clip !== null)
    return authError ? unavailable() : failure('clip_unavailable', 503)
  if (!upstream) {
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!origin) return unavailable()
    const url = new URL(
      `/storage/v1/object/public/reading/passages/${encodeURIComponent(key)}/narration.mp3`,
      origin,
    )
    try {
      upstream = await fetch(url, {
        headers: range
          ? { Range: range, 'Accept-Encoding': 'identity' }
          : { 'Accept-Encoding': 'identity' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(120_000)]),
      })
    } catch {
      return unavailable()
    }
  }
  if (![200, 206, 416].includes(upstream.status)) {
    await upstream.body?.cancel()
    return unavailable(upstream.status === 404 ? 404 : 503)
  }
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': asset ? (upstream.headers.get('content-type') ?? 'audio/mpeg') : 'audio/mpeg',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
