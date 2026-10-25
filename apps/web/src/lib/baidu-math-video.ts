import 'server-only'
import { fetchBaiduMedia } from './baidu-media'
import { problemVideoPath } from '@rosie/math-kit/utils/problem-video'

export const BAIDU_VIDEO_COOKIE = 'rosie_math_video_session'
export const BAIDU_VIDEO_COOKIE_PATH = '/api/baidu/video'

export function baiduMathVideoPath(key: string): string | null {
  return problemVideoPath(key)
}

export async function fetchBaiduMathVideo(key: string, range: string | null, signal: AbortSignal): Promise<Response | null> {
  const path = baiduMathVideoPath(key)
  return path ? fetchBaiduMedia(path, range, signal, 'video') : null
}
