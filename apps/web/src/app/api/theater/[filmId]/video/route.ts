import { type NextRequest } from 'next/server'
import { streamTheaterFilm } from '@/lib/baidu-theater'
import { serveTheaterMedia, type TheaterMediaParams } from '@/lib/theater/media-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, context: TheaterMediaParams) {
  const isCopy = request.nextUrl.searchParams.get('copy') === '1'
  return serveTheaterMedia(request, context, (id, range, signal) => streamTheaterFilm(id, range, signal, isCopy),
    '影片已下架或暂不可播放。')
}
