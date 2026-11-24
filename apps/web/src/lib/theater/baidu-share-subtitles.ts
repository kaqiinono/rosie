import 'server-only'

import { createHash } from 'node:crypto'
import { exactBaiduId, parseBaiduJson } from '../baidu-identity'
import { findProjectFile, putProjectObject } from '../baidu-project-transfer.mjs'
import { readTheaterGenerationSource } from '../baidu-theater'
import { getBaiduAccountContext } from '../baidu-token'
import { serializeTheaterSrt } from './file-transcription'
import { maxSubtitleBytes, parseTheaterSubtitles } from './subtitle-timeline'
import { theaterVideoStem, type MatchedTheaterSubtitle, type TheaterLanguage } from './types'

type Account = Awaited<ReturnType<typeof getBaiduAccountContext>>
const origin = 'https://pan.baidu.com'
const shareCookieNames = new Set(['BDCLND', 'PANPSC', 'BAIDUID', 'BAIDUID_BFESS', 'csrfToken'])

// The request sequence matches scripts/tools/movie/baidu-share-subtitles.py.
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'

async function getShareText(url: URL, signal: AbortSignal, limit: number, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('User-Agent', userAgent)
  headers.set('Accept-Encoding', 'identity')
  const response = await fetch(url, { ...init, headers, signal, cache: 'no-store', redirect: 'error' })
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel()
    throw Error('theater_share_unavailable')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw Error('theater_share_unavailable')
      }
      chunks.push(value)
    }
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), headers: response.headers }
  } finally { reader.releaseLock() }
}

function openShareSession(referer: URL, signal: AbortSignal) {
  const cookies = new Map<string, string>()
  return async (url: URL, limit: number, init: RequestInit = {}) => {
    if (url.origin !== origin) throw Error('theater_share_unavailable')
    const headers = new Headers({ Referer: referer.href, 'X-Requested-With': 'XMLHttpRequest' })
    if (cookies.size) headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '))
    const result = await getShareText(url, signal, limit, { ...init, headers })
    // Keep this share's issued cookies in memory and send them only to pan.baidu.com.
    for (const header of result.headers.getSetCookie()) {
      const pair = /^([^=;]+)=([^;]*)/.exec(header)
      if (!pair || !shareCookieNames.has(pair[1])) continue
      const [, name, value] = pair
      if (!value || /;\s*max-age=0(?:;|$)/i.test(header)) cookies.delete(name)
      else cookies.set(name, value)
    }
    return result.text
  }
}

function getUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, origin)
  url.search = new URLSearchParams(params).toString()
  return url
}

function checkedSubtitleUrl(uri: string, base: URL) {
  const url = new URL(uri, base)
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash ||
      !url.hostname.endsWith('.baidupcs.com') || url.href.length > 5000) throw Error('theater_share_unavailable')
  return url
}

function shareTracks(manifest: string, base: URL) {
  const lines = manifest.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const tracks = new Map<TheaterLanguage, URL>()
  if (lines[0] !== '#EXTM3U') return tracks
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith('#EXT-X-MEDIA:')) continue
    const attrs = new Map(Array.from(line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g), ([, key, value]) =>
      [key, value.replace(/^"|"$/g, '')] as const))
    if (attrs.get('TYPE') !== 'SUBTITLES' || attrs.get('AI-SUB') !== 'YES') continue
    const label = (attrs.get('LANGUAGE') ?? attrs.get('NAME') ?? '').toLowerCase()
    const language = /^(?:zh(?:-[a-z]+)?|中文(?:字幕)?)$/.test(label) ? 'zh'
      : /^(?:en(?:-[a-z]+)?|英文(?:字幕)?)$/.test(label) ? 'en' : null
    if (!language || tracks.has(language)) continue
    const uri = attrs.get('URI') ?? (lines[index + 1]?.startsWith('#') ? undefined : lines[index + 1])
    if (uri) tracks.set(language, checkedSubtitleUrl(uri, base))
  }
  return tracks
}

export async function importTheaterShareSubtitles(account: Account, selection: { directoryId: string; videoId: string },
  link: string, code: string, signal: AbortSignal): Promise<MatchedTheaterSubtitle[]> {
  const text = link.trim().replace(/https\\:\/\//gi, 'https://')
  const pastedUrl = /https:\/\/pan\.baidu\.com\/s\/1[\w-]+\/?(?:\?[^\s<>"'()，。；、]+)?/i.exec(text)?.[0]
  if (!pastedUrl) throw Error('theater_share_invalid')
  let share: URL
  try { share = new URL(pastedUrl) }
  catch { throw Error('theater_share_invalid') }
  const match = /^\/s\/(1[\w-]{1,80})\/?$/.exec(share.pathname)
  if (share.origin !== origin || share.username || share.password || !match) throw Error('theater_share_invalid')
  const shortId = match[1]
  const pastedCode = /提取码\s*[:：]?\s*([a-zA-Z0-9]{4})(?![a-zA-Z0-9])/.exec(text)?.[1]
  const password = code.trim() || share.searchParams.get('pwd') || pastedCode || ''
  if (password && !/^[a-zA-Z0-9]{4}$/.test(password)) throw Error('theater_share_invalid')
  const shareUrl = getUrl('/s/' + shortId, password ? { pwd: password } : {})
  const readShare = openShareSession(shareUrl, signal)
  const { directory, video } = await readTheaterGenerationSource(account, selection)

  if (password) {
    const verify = await readShare(getUrl('/share/verify', {
      surl: shortId.slice(1), channel: 'chunlei', web: '1', clienttype: '0',
    }), 64 * 1024, { method: 'POST', body: new URLSearchParams({ pwd: password, vcode: '', vcode_str: '' }) })
    if (parseBaiduJson(verify).errno !== 0) throw Error('theater_share_password')
  }
  const page = await readShare(shareUrl, 2 * 1024 * 1024)
  const locals = /locals\.mset\s*\(\s*(\{[\s\S]*?\})\s*\);/.exec(page)?.[1]
  if (!locals) throw Error('theater_share_unavailable')
  const info = parseBaiduJson(locals)
  const items = info.file_list
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.isdir !== 0) throw Error('theater_share_invalid')
  const file = items[0]
  const fid = exactBaiduId(file.fs_id)
  const uk = exactBaiduId(info.share_uk)
  const shareId = exactBaiduId(info.shareid)
  const sameFileId = uk === account.accountId && fid === video.id
  const sameFingerprint = video.md5 && typeof file.md5 === 'string' &&
    file.md5.toLowerCase() === video.md5 && Number(file.size) === video.size
  if (!sameFileId && !sameFingerprint) throw Error('theater_share_mismatch')

  const config = await readShare(getUrl('/share/tplconfig', {
    surl: shortId, fields: 'sign,timestamp', view_mode: '1',
  }), 64 * 1024)
  const body = parseBaiduJson(config)
  if (body.errno === 9019) throw Error('theater_share_session_unverified')
  const result = (body.result ?? body.data) as { sign?: unknown; timestamp?: unknown } | undefined
  if (body.errno !== 0 || typeof result?.sign !== 'string' || !result.sign ||
      (typeof result.timestamp !== 'number' && typeof result.timestamp !== 'string')) throw Error('theater_share_unavailable')
  const manifestUrl = getUrl('/share/streaming', {
    channel: 'chunlei', uk, fid, sign: result.sign, timestamp: String(result.timestamp),
    shareid: shareId, type: 'M3U8_SUBTITLE_SRT', vip: '0', jsToken: '',
  })
  const manifest = await readShare(manifestUrl, 256 * 1024)
  if (manifest.trimStart().startsWith('{') && parseBaiduJson(manifest).errno === 9019)
    throw Error('theater_share_session_unverified')
  const urls = shareTracks(manifest, manifestUrl)
  if (!urls.size) throw Error('theater_share_no_subtitle')
  const tracks = await Promise.all([...urls].map(async ([language, url]) => {
    const { text } = await getShareText(url, signal, maxSubtitleBytes, { headers: { Referer: origin + '/' } })
    const cues = parseTheaterSubtitles(text, 'captions.srt')
    return { language, cues, bytes: serializeTheaterSrt(cues) }
  }))

  const active = await getBaiduAccountContext()
  if (active.accountId !== account.accountId || active.generation !== account.generation) throw Error('baidu_account_changed')
  const current = await readTheaterGenerationSource(active, selection)
  if (current.video.path !== video.path || current.video.size !== video.size ||
      current.video.md5 !== video.md5 || current.video.modifiedAt !== video.modifiedAt) throw Error('theater_file_missing')
  const originalStem = theaterVideoStem(video.path.slice(video.path.lastIndexOf('/') + 1))
  const stem = Buffer.from(originalStem).subarray(0, 180).toString('utf8').replace(/\uFFFD$/u, '')
  return Promise.all(tracks.map(async ({ language, cues, bytes }) => {
    signal.throwIfAborted()
    if (bytes.byteLength > maxSubtitleBytes) throw Error('theater_subtitle_too_long')
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    const name = `${stem}.${language}.baidu-ai.${hash}.srt`
    const path = (directory === '/' ? '/' : directory + '/') + name
    await putProjectObject(active.accessToken, path, bytes, { verify: true })
    const stored = await findProjectFile(active.accessToken, path)
    if (!stored) throw Error('theater_share_unavailable')
    return { language, name, fileId: exactBaiduId(stored.fs_id), cueCount: cues.length, preview: cues[0].text.slice(0, 180) }
  }))
}
