import { type NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import {
  readTheaterHlsContext, THEATER_MEDIA_COOKIE, theaterError, theaterPrivateHeaders, theaterRequestError,
} from '@/lib/baidu-theater'
import { streamBaiduTheaterHls } from '@/lib/theater/baidu-hls'
import { validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const context = await readTheaterHlsContext(filmId)
    if (!context) return theaterError('影片已下架或暂不可播放。', 404)
    const response = await streamBaiduTheaterHls(context, request.nextUrl.searchParams.get('asset'), range, request.signal)
    if (!response) return theaterError('播放地址已过期，请重新打开影片。', 404)
    for (const [name, value] of Object.entries(theaterPrivateHeaders)) response.headers.set(name, value)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  } catch (error) {
    return theaterRequestError(error)
  }
}
