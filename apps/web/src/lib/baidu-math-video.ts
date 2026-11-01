import 'server-only'
import { createAdminSupabase } from './api-auth'
import { getBaiduAccountContext } from './baidu-token'
import { exactBaiduId } from './baidu-identity'
import { readBaiduDirectoryPage } from './baidu-directory-page'
import { fetchBaiduFileById } from './baidu-media'

type Context = Awaited<ReturnType<typeof getBaiduAccountContext>>

async function getLegacyReplayFile(c: Context, path: string) {
  const dir = path.slice(0, path.lastIndexOf('/'))
  for (let start = 0; start < 20000; start += 1000) {
    const entries = await readBaiduDirectoryPage(c.accessToken, dir, start, 1000)
    const match = entries.find(entry => entry.path === path && entry.isdir === 0)
    if (match) return match
    if (entries.length < 1000) break
  }
  throw Error('replay_file_not_found')
}

export const BAIDU_VIDEO_COOKIE = 'rosie_math_video_session'
export const BAIDU_VIDEO_COOKIE_PATH = '/api/baidu/video'

export async function fetchBaiduMathVideo(problemId: string, range: string | null, signal: AbortSignal) {
  const account = await getBaiduAccountContext()
  const { data, error } = await createAdminSupabase().from('math_replay_resolved')
    .select('directory,fs_id,filename').eq('account_id', account.accountId)
    .eq('problem_id', problemId).eq('available', true).maybeSingle()
  if (error) throw Error('replay_storage_unavailable')
  if (!data) return null
  const legacyPath = data.fs_id === null ? data.directory + '/' + data.filename : undefined
  const id = legacyPath ? exactBaiduId((await getLegacyReplayFile(account, legacyPath)).fs_id) : exactBaiduId(data.fs_id)
  return fetchBaiduFileById(id, data.directory, range, signal, 'video', account.accessToken, legacyPath)
}
