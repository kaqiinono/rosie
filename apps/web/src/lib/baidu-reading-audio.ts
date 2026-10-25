import 'server-only'
import { fetchBaiduMedia, listBaiduDirectory } from './baidu-media'

const ROOT = '/airosie/english/audio'
export const BAIDU_AUDIO_COOKIE = 'rosie_reading_audio_session'
export const BAIDU_AUDIO_COOKIE_PATH = '/api/baidu/audio'
const STAGES = ['4A', '5A'] as const

export function baiduReadingPath(key: string): string | null {
  const match = /^(4a|5a)-u([1-9]\d?)l([1-9]\d?)$/.exec(key)
  return match ? `${ROOT}/${match[1].toUpperCase()}/U${match[2]}L${match[3]}.mp3` : null
}

export async function listBaiduReadingKeys(): Promise<string[]> {
  const results = await Promise.all(STAGES.map(async (stage) => {
    const files = await listBaiduDirectory(`${ROOT}/${stage}`)
    return files.flatMap((file) => {
      const filename = file.path.slice(`${ROOT}/${stage}/`.length)
      const match = /^U([1-9]\d?)L([1-9]\d?)\.mp3$/.exec(filename)
      const key = match ? `${stage.toLowerCase()}-u${match[1]}l${match[2]}` : ''
      return key && baiduReadingPath(key) === file.path ? [key] : []
    })
  }))
  return results.flat()
}

export async function fetchBaiduReadingAudio(key: string, range: string | null, signal: AbortSignal): Promise<Response | null> {
  const path = baiduReadingPath(key)
  return path ? fetchBaiduMedia(path, range, signal, 'audio') : null
}
