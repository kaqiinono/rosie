import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { readBaiduFileMetadata } from '../baidu-media'
import type { readTheaterHlsContext } from '../baidu-theater'

type Context = NonNullable<Awaited<ReturnType<typeof readTheaterHlsContext>>>
type Asset = { url: string; playlist: boolean; expires: number }
const maxPlaylistBytes = 2 * 1024 * 1024
const playlistTypes = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl', 'audio/x-mpegurl'])
const notAvailable = () => Error('theater_hls_unavailable')

function baiduStreamUrl(value: string, base?: URL) {
  const url = new URL(value, base)
  const host = url.hostname
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.href.length > 3500 ||
      !(host === 'pan.baidu.com' || host.endsWith('.baidupcs.com') || host.endsWith('.pcs.baidu.com') || host === 'pcs.baidu.com'))
    throw notAvailable()
  return url
}

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw notAvailable()
  return createHash('sha256').update('rosie-baidu-hls-v1\0').update(secret).digest()
}

const scope = (context: Context) => Buffer.from([context.filmId, context.revision, context.accountGeneration].join(':'))

function seal(context: Context, asset: Asset) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(scope(context))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(asset)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

function open(context: Context, ticket: string): Asset | null {
  if (!/^[a-zA-Z0-9_-]{40,6000}$/.test(ticket)) return null
  try {
    const bytes = Buffer.from(ticket, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12))
    decipher.setAAD(scope(context))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const value: Asset = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString())
    return value.expires > Date.now() && typeof value.url === 'string' && typeof value.playlist === 'boolean' ? value : null
  } catch { return null }
}

async function fetchStream(initial: URL, range: string | null, signal: AbortSignal) {
  let url = initial
  const headers = new Headers({ 'User-Agent': 'pan.baidu.com', 'Accept-Encoding': 'identity' })
  if (range) headers.set('Range', range)
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(url, { headers, cache: 'no-store', redirect: 'manual', signal: requestSignal })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url }
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw notAvailable()
    url = baiduStreamUrl(location, url)
  }
  throw notAvailable()
}

async function readPlaylist(response: Response) {
  if (response.status !== 200 || !response.body || Number(response.headers.get('content-length')) > maxPlaylistBytes) {
    await response.body?.cancel()
    throw notAvailable()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxPlaylistBytes) {
        await reader.cancel()
        throw notAvailable()
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const manifest = Buffer.concat(chunks).toString('utf8').trim()
  if (!/^#EXTM3U\r?\n/.test(manifest) || manifest.includes('#EXT-X-DEFINE:')) throw notAvailable()
  return manifest
}

function rewritePlaylist(context: Context, text: string, upstream: URL, expires: number) {
  let variant = false
  const rewrite = (uri: string, playlist: boolean) => {
    const url = baiduStreamUrl(uri, upstream)
    const ticket = seal(context, { url: url.href, playlist, expires })
    return `/api/theater/${context.filmId}/hls?asset=${ticket}`
  }
  return text.split(/\r?\n/).map(raw => {
    const line = raw.trim()
    if (!line) return line
    if (line.startsWith('#')) {
      if (!line.startsWith('#EXT')) return ''
      if (line.startsWith('#EXT-X-STREAM-INF:')) variant = true
      const playlist = /^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF|RENDITION-REPORT):/.test(line)
      const rewritten = line.replace(/\bURI="([^"]+)"/g, (_, uri: string) => `URI="${rewrite(uri, playlist)}"`)
      if (rewritten.includes(context.token) || /\bURI=(?!"\/api\/theater\/)/.test(rewritten)) throw notAvailable()
      return rewritten
    }
    const url = rewrite(line, variant)
    variant = false
    return url
  }).join('\n') + '\n'
}

export async function streamBaiduTheaterHls(context: Context, ticket: string | null, range: string | null, signal: AbortSignal) {
  let asset: Asset
  if (ticket !== null) {
    const decoded = open(context, ticket)
    if (!decoded) return null
    asset = decoded
  } else {
    const original = await readBaiduFileMetadata(context.videoId, context.token)
    if (!original || original.path !== context.path || original.size !== context.expected.size ||
        original.md5 !== context.expected.md5 || original.modifiedAt !== context.expected.modifiedAt)
      throw Error('theater_file_missing')
    const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
    url.search = new URLSearchParams({
      method: 'streaming', path: context.path, type: 'M3U8_AUTO_480', access_token: context.token,
    }).toString()
    asset = { url: url.href, playlist: true, expires: Date.now() + 2 * 60 * 60 * 1000 }
  }

  const { response, url } = await fetchStream(baiduStreamUrl(asset.url), asset.playlist ? null : range, signal)
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  if (asset.playlist || playlistTypes.has(contentType)) {
    const playlist = rewritePlaylist(context, await readPlaylist(response), url, asset.expires)
    return new Response(playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } })
  }
  if (response.status === 416) {
    await response.body?.cancel()
    const contentRange = response.headers.get('content-range')
    return new Response(null, { status: 416, headers: contentRange ? { 'Content-Range': contentRange } : {} })
  }
  if (![200, 206].includes(response.status) ||
      !/^(?:video\/|audio\/|(?:application|binary)\/octet-stream$)/.test(contentType)) {
    await response.body?.cancel()
    throw notAvailable()
  }
  const headers = new Headers({ 'Content-Type': contentType })
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(response.body, { status: response.status, headers })
}
