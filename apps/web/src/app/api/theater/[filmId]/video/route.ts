import { type NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import {
  streamTheaterFilm, THEATER_MEDIA_COOKIE, theaterError, theaterPrivateHeaders, theaterRequestError,
} from '@/lib/baidu-theater'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ filmId: string }> }) {
  const token = request.cookies.get(THEATER_MEDIA_COOKIE)?.value
  if (!token || !await getUserFromRequest(new Request(request.url, {
    headers: { Authorization: 'Bearer ' + token },
  }))) return theaterError('请重新打开影片。', 401)
  const { filmId } = await params
  if (!validTheaterId(filmId)) return theaterError('影片不存在。', 404)
  const range = request.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return theaterError('请求的视频范围无效。', 416)
  try {
    const source = await streamTheaterFilm(filmId, range, request.signal, request.nextUrl.searchParams.get('copy') === '1')
    if (!source) return theaterError('影片已下架或暂不可播放。', 404)
    const { upstream, contentType } = source
    const headers = new Headers({
      ...theaterPrivateHeaders, 'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    })
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    return theaterRequestError(error)
  }
}
