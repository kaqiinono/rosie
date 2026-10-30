import 'server-only'
import { getBaiduAccountContext } from './baidu-token'
import { exactBaiduId, parseBaiduJson } from './baidu-identity'
type Context = Awaited<ReturnType<typeof getBaiduAccountContext>>
type Range = { start: number; end: number }
export const materialPrivateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "sandbox; default-src 'none'",
}
export function materialMime(mime: string) {
  return [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'application/pdf',
  ].includes(mime)
    ? mime
    : 'application/octet-stream'
}
export function materialRange(raw: string | null, size: number): Range | null {
  if (!raw) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(raw)
  if (!m || (!m[1] && !m[2])) throw Error('range_not_satisfiable')
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])),
    end = m[1] ? (m[2] ? Math.min(Number(m[2]), size - 1) : size - 1) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start ||
    (!m[1] && Number(m[2]) === 0)
  )
    throw Error('range_not_satisfiable')
  return { start, end }
}
export function deliverMaterialStream(
  upstream: Response,
  size: number,
  range: Range | null,
  mime: string,
  name: string,
  download = false,
) {
  const expected = range ? range.end - range.start + 1 : size
  if (
    !upstream.body ||
    (range
      ? upstream.status !== 206 ||
        upstream.headers.get('content-range') !== `bytes ${range.start}-${range.end}/${size}`
      : upstream.status !== 200) ||
    (upstream.headers.get('content-encoding') &&
      upstream.headers.get('content-encoding') !== 'identity') ||
    (upstream.headers.has('content-length') &&
      Number(upstream.headers.get('content-length')) !== expected)
  ) {
    void upstream.body?.cancel()
    throw Error('provider_range_or_size_mismatch')
  }
  const reader = upstream.body.getReader()
  let count = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const r = await reader.read()
        if (r.done) {
          if (count !== expected) throw Error('provider_truncated')
          controller.close()
          return
        }
        count += r.value.byteLength
        if (count > expected) throw Error('provider_overflow')
        controller.enqueue(r.value)
      } catch (e) {
        await reader.cancel().catch(() => {})
        controller.error(e)
      }
    },
    async cancel(reason) {
      await reader.cancel(reason)
    },
  })
  const type = materialMime(mime),
    headers = new Headers({
      ...materialPrivateHeaders,
      'Content-Type': type,
      'Content-Length': String(expected),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${download || type === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="material"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`,
    })
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  return new Response(body, { status: range ? 206 : 200, headers })
}
async function api(c: Context, params: Record<string, string>, endpoint = 'file') {
  const u = new URL(`https://pan.baidu.com/rest/2.0/xpan/${endpoint}`)
  u.search = new URLSearchParams({ ...params, access_token: c.accessToken }).toString()
  const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw Error('baidu_metadata_unavailable')
  const d = parseBaiduJson(await r.text()) as Record<string, unknown>
  if (d.errno !== 0) throw Error('baidu_metadata_unavailable')
  return d
}
export async function getMaterialFile(c: Context, path: string) {
  const dir = path.slice(0, path.lastIndexOf('/'))
  for (let start = 0; start < 20000; start += 1000) {
    const d = await api(c, { method: 'list', dir, start: String(start), limit: '1000' })
    if (!Array.isArray(d.list)) throw Error('baidu_invalid_metadata')
    const f = d.list.find((r: Record<string, unknown>) => r.path === path)
    if (f) return f as Record<string, unknown>
    if (d.list.length < 1000) break
  }
  throw Error('upload_file_not_verified')
}
function safeProviderUrl(raw: string) {
  const u = new URL(raw)
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    !['baidu.com', 'baidupcs.com'].some(
      (host) => u.hostname === host || u.hostname.endsWith('.' + host),
    )
  )
    throw Error('baidu_invalid_download_host')
  return u
}
export async function openProviderFile(
  c: Context,
  fsid: string,
  size: number,
  range: Range | null,
  signal?: AbortSignal,
) {
  fsid = exactBaiduId(fsid)
  const d = await api(c, { method: 'filemetas', fsids: `[${fsid}]`, dlink: '1' }, 'multimedia'),
    list = d.list as Record<string, unknown>[]
  const f = Array.isArray(list) ? list.find((f) => exactBaiduId(f.fs_id) === fsid) : null
  if (!f || f.size !== size || f.isdir !== 0 || typeof f.dlink !== 'string')
    throw Error('baidu_invalid_metadata')
  let u = safeProviderUrl(f.dlink)
  u.searchParams.set('access_token', c.accessToken)
  const abort = AbortSignal.any([AbortSignal.timeout(280000), ...(signal ? [signal] : [])])
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, {
      headers: {
        'User-Agent': 'pan.baidu.com',
        'Accept-Encoding': 'identity',
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      },
      redirect: 'manual',
      cache: 'no-store',
      signal: abort,
    })
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      await r.body?.cancel()
      u = safeProviderUrl(new URL(r.headers.get('location') ?? '', u).href)
      continue
    }
    return r
  }
  throw Error('baidu_redirect_limit')
}
