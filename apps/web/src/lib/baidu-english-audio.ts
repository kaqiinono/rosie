import 'server-only'
import { lessonAudioMime } from '@rosie/english/utils/reading-audio-types'
import { createAdminSupabase } from './api-auth'
import { fetchBaiduFileById } from './baidu-media'
import { getBaiduAccountContext } from './baidu-token'

export async function listEnglishAudioSlots() {
  const account = await getBaiduAccountContext()
  const keys: string[] = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await createAdminSupabase().from('english_audio_bindings')
      .select('lesson_key,slot').eq('account_id', account.accountId)
      .order('lesson_key').order('slot').range(start, start + 499)
    if (error) throw error
    keys.push(...data.map(row => row.lesson_key + '#' + row.slot))
    if (data.length < 500) return keys
  }
}

export async function fetchEnglishAudio(key: string, slot: string, range: string | null, signal: AbortSignal) {
  const account = await getBaiduAccountContext()
  const { data, error } = await createAdminSupabase().from('english_audio_bindings')
    .select('file_id,path').eq('account_id', account.accountId).eq('lesson_key', key).eq('slot', slot).maybeSingle()
  if (error) throw error
  if (!data) return null
  const directory = data.path.slice(0, data.path.lastIndexOf('/')) || '/'
  const stream = await fetchBaiduFileById(data.file_id, directory, range, signal, 'audio', account.accessToken, data.path)
  if (!stream) return null
  const headers = new Headers(stream.headers)
  headers.set('Content-Type', lessonAudioMime(data.path) ?? 'application/octet-stream')
  return new Response(stream.body, { status: stream.status, headers })
}
