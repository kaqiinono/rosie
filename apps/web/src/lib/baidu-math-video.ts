import 'server-only'
import { fetchBaiduMedia } from './baidu-media'

export const BAIDU_VIDEO_COOKIE = 'rosie_math_video_session'
export const BAIDU_VIDEO_COOKIE_PATH = '/api/baidu/video'

export function baiduMathVideoPath(key: string): string | null {
  return /^\d+-\d+-[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(key)
    ? `/airosie/math/ny/${key}.mp4`
    : null
}

export async function fetchBaiduMathVideo(key: string, range: string | null, signal: AbortSignal): Promise<Response | null> {
  const path = baiduMathVideoPath(key)
  return path ? fetchBaiduMedia(path, range, signal, 'video') : null
}
