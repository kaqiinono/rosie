import { fetchBaiduFileById } from '@/lib/baidu-media'
import { theaterError, theaterPrivateHeaders } from '@/lib/baidu-theater'
import { readTheaterSubtitleSource } from '@/lib/theater/subtitle-jobs'
import { theaterSourceExpiry } from '@/lib/theater/subtitle-worker-auth'
import { theaterVideoExtension, theaterVideoFormat, theaterVideoMime, validTheaterId } from '@/lib/theater/types'

export const runtime = 'nodejs'
export const maxDuration = 300

async function serve(request: Request, { params }: { params: Promise<{ jobId: string; filename: string }> }) {
  const { jobId, filename } = await params
  if (!validTheaterId(jobId) || !/^video\.(mp4|mkv)$/.test(filename)) return theaterError('影片不可用。', 404)
  const expiry = theaterSourceExpiry(jobId, new URL(request.url).searchParams.get('ticket') ?? '')
  if (expiry === null) return theaterError('影片不可用。', 404)
  const range = request.headers.get('range')
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return theaterError('无效的视频范围。', 416)
  try {
    const source = await readTheaterSubtitleSource(jobId, expiry)
    if (!source) return theaterError('影片不可用。', 404)
    const { account, directory, video } = source
    const format = theaterVideoFormat(video.path)
    if (!format || filename !== 'video.' + format) return theaterError('影片不可用。', 404)
    const headers = new Headers({
      ...theaterPrivateHeaders, 'Content-Type': theaterVideoMime[format],
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    })
    if (request.method === 'HEAD') {
      headers.set('content-length', String(video.size))
      headers.set('accept-ranges', 'bytes')
      return new Response(null, { headers })
    }
    const response = await fetchBaiduFileById(video.id, directory, range, request.signal, 'video',
      account.accessToken, video.path, video, 'published', 270_000, theaterVideoExtension)
    if (!response) return theaterError('影片不可用。', 404)
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = response.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(response.body, { status: response.status, headers })
  } catch {
    return theaterError('暂时无法读取影片。', 503)
  }
}

export const GET = serve
export const HEAD = serve
