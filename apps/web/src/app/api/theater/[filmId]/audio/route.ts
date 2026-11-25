import { type NextRequest } from 'next/server'
import { streamTheaterAudio } from '@/lib/baidu-theater'
import { serveTheaterMedia, type TheaterMediaParams } from '@/lib/theater/media-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, context: TheaterMediaParams) {
  return serveTheaterMedia(request, context, streamTheaterAudio, '影片的外部音轨暂不可播放。')
}
