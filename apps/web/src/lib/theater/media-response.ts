import { type NextRequest } from 'next/server'
import { getUserFromRequest } from '../api-auth'
import { THEATER_MEDIA_COOKIE, theaterError, theaterPrivateHeaders, theaterRequestError } from '../baidu-theater'
import { validTheaterId } from './types'

export type TheaterMediaParams = { params: Promise<{ filmId: string }> }

export async function serveTheaterMedia(request: NextRequest, { params }: TheaterMediaParams,
  stream: (id: string, range: string | null, signal: AbortSignal) => Promise<{ upstream: Response; contentType: string } | null>,
  missing: string) {
  const token = request.cookies.get(THEATER_MEDIA_COOKIE)?.value
  if (!token || !await getUserFromRequest(new Request(request.url, {
    headers: { Authorization: 'Bearer ' + token },
  }))) return theaterError('请重新打开影片。', 401)
  const { filmId } = await params
  if (!validTheaterId(filmId)) return theaterError('影片不存在。', 404)
  const range = request.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return theaterError('请求的媒体范围无效。', 416)
  try {
    const source = await stream(filmId, range, request.signal)
    if (!source) return theaterError(missing, 404)
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
