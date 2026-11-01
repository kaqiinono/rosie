import 'server-only'
import { parseBaiduJson } from './baidu-identity'

interface ProviderEntry {
  fs_id: unknown
  path: unknown
  isdir: unknown
  size?: unknown
  server_filename?: unknown
}

export async function readBaiduDirectoryPage(
  accessToken: string, directory: string, start: number, limit: number,
): Promise<ProviderEntry[]> {
  const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
  url.search = new URLSearchParams({
    method: 'list', dir: directory, start: String(start), limit: String(limit),
    order: 'name', access_token: accessToken,
  }).toString()
  const response = await fetch(url, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
  })
  const body = parseBaiduJson(await response.text())
  if (body.errno === -9) throw Error('baidu_directory_missing')
  if ([-6, 110, 111].includes(Number(body.errno ?? body.error_code))) throw Error('baidu_reauthorize')
  if (!response.ok || body.errno !== 0 || !Array.isArray(body.list) || body.list.length > limit)
    throw Error('baidu_list_failed')
  return body.list
}
