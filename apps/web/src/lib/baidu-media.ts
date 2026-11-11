import 'server-only'
import { exactBaiduId, parseBaiduJson } from './baidu-identity'
import { getBaiduAccountContext, getBaiduAccessToken } from './baidu-token'

interface NetdiskFile {
  fs_id: string
  path: string
  isdir: number
}
interface DirectoryCache {
  files: NetdiskFile[]
  expires: number
}
const directories = new Map<string, DirectoryCache>()
const pendingDirectories = new Map<string, Promise<NetdiskFile[]>>()

async function baiduJson(
  path: string,
  parameters: Record<string, string>,
  accessToken?: string,
): Promise<Record<string, unknown>> {
  const url = new URL(path, 'https://pan.baidu.com')
  url.search = new URLSearchParams({
    ...parameters,
    access_token: accessToken ?? (await getBaiduAccessToken()),
  }).toString()
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'pan.baidu.com' },
  })
  const body: unknown = parseBaiduJson(await response.text())
  if (!body || typeof body !== 'object') throw new Error('baidu_unavailable')
  const result = body as Record<string, unknown>
  if (result.errno === -9) return { errno: 0, list: [] }
  if ([-6, 110, 111].includes(Number(result.errno ?? result.error_code)))
    throw Error('baidu_reauthorize')
  if (!response.ok || result.errno !== 0) throw new Error('baidu_api_error')
  return result
}

export async function listBaiduDirectory(
  directory: string,
  expectedAccount?: Awaited<ReturnType<typeof getBaiduAccountContext>>,
): Promise<NetdiskFile[]> {
  const context = expectedAccount ?? (await getBaiduAccountContext())
  const cacheKey = `${context.accountId}:${context.generation}:${directory}`
  const cached = directories.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.files
  const pending = pendingDirectories.get(cacheKey)
  if (pending) return pending
  const promise = (async () => {
    const files: NetdiskFile[] = []
    for (let start = 0; start < 10_000; start += 1000) {
      const result = await baiduJson(
        '/rest/2.0/xpan/file',
        {
          method: 'list',
          dir: directory,
          start: String(start),
          limit: '1000',
          order: 'name',
        },
        context.accessToken,
      )
      if (!Array.isArray(result.list)) throw new Error('baidu_invalid_response')
      for (const item of result.list) {
        if (!item || typeof item !== 'object') continue
        const file = item as Record<string, unknown>
        if (typeof file.path === 'string' && file.isdir === 0) {
          files.push({ path: file.path, fs_id: exactBaiduId(file.fs_id), isdir: 0 })
        }
      }
      if (result.list.length < 1000) {
        const current = await getBaiduAccountContext()
        if (current.generation !== context.generation || current.accountId !== context.accountId)
          throw Error('baidu_account_changed')
        directories.set(cacheKey, { files, expires: Date.now() + 60_000 })
        return files
      }
    }
    throw new Error('baidu_directory_too_large')
  })().finally(() => {
    pendingDirectories.delete(cacheKey)
  })
  pendingDirectories.set(cacheKey, promise)
  return promise
}

function safeDownloadUrl(value: string): URL {
  const url = new URL(value)
  const allowed = ['baidu.com', 'baidupcs.com'].some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  )
  if (
    url.protocol !== 'https:' ||
    !allowed ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  )
    throw new Error('baidu_invalid_download')
  return url
}

/** Never forward the browser's cookies/Authorization or expose a Baidu Location header. */
export async function fetchBaiduMedia(
  path: string,
  range: string | null,
  signal: AbortSignal,
  kind: 'audio' | 'video',
): Promise<Response | null> {
  const directory = path.slice(0, path.lastIndexOf('/'))
  const file = (await listBaiduDirectory(directory)).find((item) => item.path === path)
  if (!file) return null
  return fetchBaiduFileById(
    file.fs_id,
    directory,
    range,
    signal,
    kind,
    await getBaiduAccessToken(),
    path,
  )
}

/** The metadata and download use the same account token. A move outside the bound directory invalidates playback. */
export async function fetchBaiduFileById(
  fsId: string,
  directory: string,
  range: string | null,
  signal: AbortSignal,
  kind: 'audio' | 'video' | 'material',
  token: string,
  expectedPath?: string,
): Promise<Response | null> {
  const id = exactBaiduId(fsId)
  const metadata = await baiduJson(
    '/rest/2.0/xpan/multimedia',
    {
      method: 'filemetas',
      fsids: `[${id}]`,
      dlink: '1',
    },
    token,
  )
  const info = Array.isArray(metadata.list) ? metadata.list[0] : null
  const prefix = directory === '/' ? '/' : directory + '/'
  if (
    !info ||
    exactBaiduId(info.fs_id) !== id ||
    info.isdir === 1 ||
    typeof info.path !== 'string' ||
    !info.path.startsWith(prefix) ||
    info.path.slice(prefix.length).includes('/') ||
    (expectedPath && info.path !== expectedPath) ||
    (kind === 'video' && !/\.mp4$/i.test(info.path))
  )
    return null
  if (typeof info.dlink !== 'string') throw Error('baidu_download_failed')
  let download = safeDownloadUrl(info.dlink)
  const headers = new Headers({ 'User-Agent': 'pan.baidu.com', 'Accept-Encoding': 'identity' })
  if (range) headers.set('Range', range)
  const downloadSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)])
  for (let redirect = 0; redirect < 5; redirect += 1) {
    download.searchParams.set('access_token', token)
    const response = await fetch(download, {
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: downloadSignal,
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('baidu_invalid_download')
      download = safeDownloadUrl(new URL(location, download).toString())
      continue
    }
    if (response.status === 416) return response
    const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? ''
    // Provider auth errors can arrive as JSON instead of media bytes.
    if (
      (contentType === 'application/json' || contentType.endsWith('+json')) &&
      (kind !== 'material' || ![200, 206].includes(response.status))
    ) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object') {
        const result = body as Record<string, unknown>
        if ([-6, 110, 111].includes(Number(result.errno ?? result.error_code)))
          throw Error('baidu_reauthorize')
      }
      throw Error('baidu_download_failed')
    }
    if (
      ![200, 206].includes(response.status) ||
      !(
        kind === 'material' ||
        contentType.startsWith(`${kind}/`) ||
        ['application/octet-stream', 'binary/octet-stream'].includes(contentType)
      )
    ) {
      await response.body?.cancel()
      throw new Error('baidu_download_failed')
    }
    return response
  }
  throw new Error('baidu_redirect_limit')
}
