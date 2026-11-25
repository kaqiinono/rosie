import 'server-only'
import { baiduAuthErrorCode, BAIDU_AUTH_MESSAGES } from '@rosie/core'
import { NextResponse } from 'next/server'
import { createAdminSupabase } from './api-auth'
import { readBaiduDirectoryPage } from './baidu-directory-page'
import { exactBaiduId } from './baidu-identity'
import {
  fetchBaiduFileById,
  readBaiduFileMetadata,
  type BaiduFileFingerprint,
  type BaiduFileMetadata,
} from './baidu-media'
import { findProjectFile, isPrivateProjectPath } from './baidu-project-transfer.mjs'
import { getBaiduAccountContext } from './baidu-token'
import { maxSubtitleBytes, parseTheaterSubtitles } from './theater/subtitle-timeline'
import {
  theaterSubtitleLanguages,
  theaterPlaybackCopyName,
  theaterVideoExtension,
  theaterVideoFormat,
  theaterVideoMime,
  theaterVideoStem,
  type MatchedTheaterSubtitle,
  type TheaterSubtitleMatchResult,
  type TheaterAdminFilm,
  type TheaterDirectoryFile,
  type TheaterDirectoryInventory,
  type TheaterMediaDirectory,
  type TheaterFilm,
  type TheaterLanguage,
} from './theater/types'

export const THEATER_MEDIA_COOKIE = 'rosie_theater_session'
export const THEATER_MEDIA_PATH = '/api/theater'
export const theaterPrivateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, Cookie',
}

type Account = Awaited<ReturnType<typeof getBaiduAccountContext>>
const filmFields = 'id,title,directory_id,directory_path,video_file_id,video_name,playback_file_id,playback_name,subtitle_en_file_id,subtitle_en_name,subtitle_zh_file_id,subtitle_zh_name,file_fingerprints,published,revision'

interface FilmRow {
  id: string
  title: string
  directory_id: string | null
  directory_path: string
  video_file_id: string
  video_name: string
  playback_file_id: string | null
  playback_name: string | null
  subtitle_en_file_id: string | null
  subtitle_en_name: string | null
  subtitle_zh_file_id: string | null
  subtitle_zh_name: string | null
  file_fingerprints: Partial<Record<'video' | 'playback' | TheaterLanguage, BaiduFileFingerprint>>
  published: boolean
  revision: string
}

export function theaterError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: theaterPrivateHeaders })
}

export function theaterRequestError(error: unknown) {
  const baidu = baiduAuthErrorCode(error)
  if (baidu) return theaterError(BAIDU_AUTH_MESSAGES[baidu], 409)
  const code = error instanceof Error ? error.message : ''
  if (['baidu_account_changed', 'theater_conflict'].includes(code))
    return theaterError('片库或网盘授权已更新，请重新读取后操作。', 409)
  if (['theater_file_missing', 'baidu_file_changed', 'baidu_directory_missing'].includes(code))
    return theaterError('网盘文件或目录已移动、替换或移除，请重新核对绑定。', 404)
  if (code === 'theater_duplicate') return theaterError('这份视频已有上架的版本，请先下架旧版本。', 409)
  if (code === 'theater_directory_setting_conflict')
    return theaterError('媒体目录已被更新，请重新打开电影剧场后再更改。', 409)
  if (code === 'theater_invalid_source') return theaterError('请从选定的授权目录选择视频和字幕文件。', 400)
  if (code === 'theater_subtitle_too_long') return theaterError('字幕文件过大，请选择小于 2 MB 的字幕。', 400)
  if (code === 'theater_directory_too_large')
    return theaterError('此目录文件太多，请选择范围更小的影片目录。', 422)
  if (code === 'theater_subtitle_film_missing') return theaterError('影片已下架或暂不可播放。', 404)
  if (code === 'theater_subtitle_source_conflict')
    return theaterError('字幕版本已变化或网盘源文件已被修改，请核对后重试。', 409)
  if (code === 'theater_subtitle_sync_locked')
    return theaterError('这批修订正在同步，或需要先完成上一次同步。', 409)
  if (code === 'theater_subtitle_sync_unverified')
    return theaterError('未能验证网盘字幕，请重试同步。', 502)
  if (code === 'theater_subtitle_revision_invalid')
    return theaterError('当前台词包含该字幕格式无法保留的内容，请检查换行或特殊符号。', 400)
  if (code === 'theater_subtitle_empty') return theaterError('字幕中没有可识别的台词，请检查格式与时间轴。', 400)
  if (code === 'theater_playback_copy_missing') return theaterError('影片同目录未找到对应的 .playback.mp4 播放副本。', 404)
  if (code === 'theater_hls_unavailable') return theaterError('百度网盘暂未提供可用的转码播放流。', 422)
  if (code === 'theater_share_invalid') return theaterError('请选择对应影片的单文件分享链接，并核对提取码格式。', 400)
  if (code === 'theater_share_password') return theaterError('分享提取码验证失败。', 400)
  if (code === 'theater_share_session_unverified') return theaterError('百度网盘要求重新验证分享会话，请重试获取字幕。', 502)
  if (code === 'theater_share_mismatch') return theaterError('无法确认此分享链接对应所选影片，请核对后重试。', 409)
  if (code === 'theater_share_no_subtitle') return theaterError('这个分享的播放器没有可导入的中英文字幕。', 422)
  if (code === 'theater_share_unavailable') return theaterError('暂时无法读取分享字幕或写回网盘，请核对链接后重试。', 502)
  return theaterError('暂时无法读取片库或网盘，请重试。', 503)
}

const filmTable = () => createAdminSupabase().from('theater_films')
const prefixFor = (directory: string) => directory === '/' ? '/' : directory + '/'
const sourceName = (path: string, directory: string) => path.slice(prefixFor(directory).length)
const videoInventoryPattern = /\.(mp4|mkv|webm|mov|m4v|avi|wmv|mpeg|mpg|flv|ts|m2ts|mts|rmvb|3gp|asf|vob|ogv)$/i
const subtitlePattern = /\.(srt|vtt|ass)$/i

function withinTheaterRoot(path: string, root: string) {
  if (!path.startsWith('/') || isPrivateProjectPath(path) ||
      (path !== root && !path.startsWith(prefixFor(root)))) return false
  return path === '/' || path.slice(1).split('/').every(part => part && part !== '.' && part !== '..' &&
    !/[\\\x00-\x1f\x7f]|%(?:25|2e|2f|5c)/i.test(part))
}

function scopedFilms(account: Account) {
  return filmTable().select(filmFields).eq('account_id', account.accountId)
    .eq('account_generation', account.generation)
}

function publicFilm(row: FilmRow): TheaterFilm {
  return {
    id: row.id,
    title: row.title,
    languages: theaterSubtitleLanguages.filter(language => row[`subtitle_${language}_file_id` as const]),
    format: theaterVideoFormat(row.video_name) ?? 'mp4',
    hasPlaybackCopy: Boolean(row.playback_file_id),
  }
}

async function directoryStillBound(account: Account, film: FilmRow) {
  if (!film.directory_id) return false
  const { data, error } = await createAdminSupabase().from('baidu_sync_directories').select('path')
    .eq('id', film.directory_id).eq('account_id', account.accountId).maybeSingle()
  if (error) throw error
  return typeof data?.path === 'string' && withinTheaterRoot(film.directory_path, data.path)
}

export async function readTheaterCatalog(): Promise<TheaterFilm[]> {
  const account = await getBaiduAccountContext()
  const { data, error } = await scopedFilms(account).eq('published', true).not('directory_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as FilmRow[]).map(publicFilm)
}

export async function readTheaterAdminCatalog(account: Account): Promise<TheaterAdminFilm[]> {
  const { data, error } = await scopedFilms(account).order('created_at', { ascending: false })
  if (error) throw error
  return (data as FilmRow[]).map(row => ({
    ...publicFilm(row), published: row.published && row.directory_id !== null, revision: row.revision, directoryId: row.directory_id,
    videoName: row.video_name, playbackName: row.playback_name,
  }))
}

async function publishedFilm(filmId: string) {
  const account = await getBaiduAccountContext()
  const { data, error } = await scopedFilms(account).eq('id', filmId).eq('published', true).maybeSingle()
  if (error) throw error
  const film = data as FilmRow | null
  if (!film || !await directoryStillBound(account, film)) return null
  return { film, account }
}

export async function readTheaterFilm(filmId: string) {
  const source = await publishedFilm(filmId)
  return source ? publicFilm(source.film) : null
}

function checkSource(file: BaiduFileMetadata | null, directory: string, extensions: RegExp) {
  if (!file || !file.size || !file.path.startsWith(prefixFor(directory)) ||
      sourceName(file.path, directory).includes('/') || !withinTheaterRoot(file.path, directory) ||
      !extensions.test(file.path) || (!file.md5 && !file.modifiedAt)) throw Error('theater_invalid_source')
  return file
}

function fingerprintOf({ size, md5, modifiedAt }: BaiduFileMetadata): BaiduFileFingerprint {
  return { size, md5, modifiedAt }
}

async function readTheaterDirectory(account: Account, directoryId: string) {
  const { data, error } = await createAdminSupabase().from('baidu_sync_directories').select('path')
    .eq('id', directoryId).eq('account_id', account.accountId).maybeSingle()
  if (error) throw error
  const path: unknown = data?.path
  if (typeof path !== 'string' || !withinTheaterRoot(path, path)) throw Error('theater_invalid_source')
  return path
}

const mediaDirectoryTable = () => createAdminSupabase().from('theater_media_directories')

export async function readTheaterMediaDirectory(account: Account): Promise<TheaterMediaDirectory | null> {
  const { data, error } = await mediaDirectoryTable()
    .select('directory_id,revision,baidu_sync_directories!inner(path,account_id)')
    .eq('account_id', account.accountId).eq('baidu_sync_directories.account_id', account.accountId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const bookmark = data.baidu_sync_directories as unknown as { path?: unknown } | null
  const path = bookmark?.path
  if (typeof path !== 'string' || !withinTheaterRoot(path, path)) return null
  return { directoryId: data.directory_id, path, revision: data.revision }
}

export async function saveTheaterMediaDirectory(
  account: Account, directoryId: string, revision: string | null, signal: AbortSignal,
): Promise<TheaterMediaDirectory> {
  const current = await readTheaterMediaDirectory(account)
  if (current?.directoryId === directoryId) return current
  if ((current?.revision ?? null) !== revision) throw Error('theater_directory_setting_conflict')

  const path = await readTheaterDirectory(account, directoryId)
  await readBaiduDirectoryPage(account.accessToken, path, 0, 1, signal)
  await requireCurrentTheaterAccount(account)
  if (await readTheaterDirectory(account, directoryId) !== path) throw Error('theater_directory_setting_conflict')
  signal.throwIfAborted()

  const next = { account_id: account.accountId, directory_id: directoryId, revision: crypto.randomUUID() }
  const result = current
    ? await mediaDirectoryTable().update(next).eq('account_id', account.accountId)
      .eq('revision', current.revision).select('revision').maybeSingle()
    : await mediaDirectoryTable().insert(next).select('revision').maybeSingle()
  if (result.error?.code === '23503') throw Error('baidu_directory_missing')
  if (result.error && result.error.code !== '23505') throw result.error
  if (result.data) return { directoryId, path, revision: result.data.revision }

  const latest = await readTheaterMediaDirectory(account)
  if (latest?.directoryId === directoryId) return latest
  throw Error('theater_directory_setting_conflict')
}

export async function readTheaterDirectoryInventory(
  account: Account, directoryId: string, signal: AbortSignal,
): Promise<TheaterDirectoryInventory> {
  const root = await readTheaterDirectory(account, directoryId)
  const visited = new Set([root])
  const folders = [root]
  const videos = new Map<string, TheaterDirectoryFile>()
  const subtitles = new Map<string, TheaterDirectoryFile>()
  const pageSize = 500

  async function scan(directory: string) {
    for (let offset = 0; ; offset += pageSize) {
      signal.throwIfAborted()
      const rows = await readBaiduDirectoryPage(account.accessToken, directory, offset, pageSize, signal)
      for (const row of rows) {
        if (typeof row.path !== 'string' || !row.path.startsWith(prefixFor(directory)) ||
            !withinTheaterRoot(row.path, root)) continue
        const name = sourceName(row.path, directory)
        if (!name || name.includes('/')) continue
        if (row.isdir === 1 && !visited.has(row.path)) {
          visited.add(row.path)
          folders.push(row.path)
        }
        if (row.isdir !== 0) continue
        const kind = videoInventoryPattern.test(name) ? videos : subtitlePattern.test(name) ? subtitles : null
        if (!kind) continue
        const fileId = exactBaiduId(row.fs_id)
        kind.set(fileId, { fileId, name, folder: directory === root ? '' : sourceName(directory, root) })
      }
      if (rows.length < pageSize) return
    }
  }

  for (let start = 0; start < folders.length;) {
    const batch = folders.slice(start, start + 4)
    start += batch.length
    await Promise.all(batch.map(scan))
  }
  const copies = new Set<string>()
  for (const file of videos.values()) {
    const format = theaterVideoFormat(file.name)
    if (format === 'mkv' || format === 'rmvb') copies.add(`${file.folder}/${theaterPlaybackCopyName(file.name)}`)
  }
  for (const file of videos.values()) {
    if (copies.has(`${file.folder}/${file.name}`)) videos.delete(file.fileId)
  }
  let afterId: string | undefined
  while (videos.size) {
    signal.throwIfAborted()
    let query = filmTable().select('id,video_file_id')
      .eq('account_id', account.accountId).eq('account_generation', account.generation)
      .not('directory_id', 'is', null).order('id').limit(pageSize).abortSignal(signal)
    if (afterId) query = query.gt('id', afterId)
    const { data, error } = await query
    if (error) throw error
    for (const film of data) videos.delete(film.video_file_id)
    if (data.length < pageSize) break
    afterId = data[data.length - 1].id
  }
  await requireCurrentTheaterAccount(account)
  if (await readTheaterDirectory(account, directoryId) !== root) throw Error('theater_conflict')
  signal.throwIfAborted()
  const byPath = (a: TheaterDirectoryFile, b: TheaterDirectoryFile) =>
    a.folder.localeCompare(b.folder, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
  return { videos: [...videos.values()].sort(byPath), subtitles: [...subtitles.values()].sort(byPath) }
}

async function requireCurrentTheaterAccount(account: Account) {
  const current = await getBaiduAccountContext()
  if (current.generation !== account.generation || current.accountId !== account.accountId)
    throw Error('baidu_account_changed')
}

export async function readTheaterSubtitleBytes(
  account: Account, directory: string, id: string, name: string, fingerprint: BaiduFileFingerprint, signal: AbortSignal,
) {
  if (fingerprint.size > maxSubtitleBytes) throw Error('theater_subtitle_too_long')
  const response = await fetchBaiduFileById(id, directory, null, signal, 'material', account.accessToken,
    prefixFor(directory) + name, fingerprint)
  if (!response?.body || response.status !== 200) {
    await response?.body?.cancel()
    throw Error('theater_file_missing')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxSubtitleBytes) {
        await reader.cancel()
        throw Error('theater_subtitle_too_long')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}

export function decodeTheaterSubtitle(buffer: Uint8Array) {
  let decoded: string
  if (buffer[0] === 0xff && buffer[1] === 0xfe) decoded = new TextDecoder('utf-16le').decode(buffer)
  else if (buffer[0] === 0xfe && buffer[1] === 0xff) decoded = new TextDecoder('utf-16be').decode(buffer)
  else {
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
    catch { decoded = new TextDecoder('gb18030').decode(buffer) }
  }
  return decoded
}

async function subtitleFile(
  account: Account, directory: string, id: string, name: string, fingerprint: BaiduFileFingerprint, signal: AbortSignal,
) {
  const bytes = await readTheaterSubtitleBytes(account, directory, id, name, fingerprint, signal)
  return parseTheaterSubtitles(decodeTheaterSubtitle(bytes), name)
}

export async function saveTheaterFilm(account: Account, input: {
  title: string
  directoryId: string
  videoId: string
  enId: string | null
  zhId: string | null
}, signal: AbortSignal) {
  const [source, englishMeta, chineseMeta] = await Promise.all([
    readTheaterGenerationSource(account, input),
    input.enId ? readBaiduFileMetadata(exactBaiduId(input.enId), account.accessToken) : null,
    input.zhId ? readBaiduFileMetadata(exactBaiduId(input.zhId), account.accessToken) : null,
  ])
  const { root, directory, video } = source
  const en = input.enId ? checkSource(englishMeta, directory, subtitlePattern) : null
  const zh = input.zhId ? checkSource(chineseMeta, directory, subtitlePattern) : null
  const files = { video: fingerprintOf(video), en: en ? fingerprintOf(en) : null, zh: zh ? fingerprintOf(zh) : null }
  await Promise.all([en, zh].map(file => file && subtitleFile(account, directory, file.id,
    sourceName(file.path, directory), fingerprintOf(file), signal)))
  await requireCurrentTheaterAccount(account)
  if (await readTheaterDirectory(account, input.directoryId) !== root) throw Error('theater_conflict')
  signal.throwIfAborted()
  const { error: insertError } = await filmTable().insert({
    title: input.title, account_id: account.accountId, account_generation: account.generation,
    directory_id: input.directoryId, directory_path: directory,
    video_file_id: video.id, video_name: sourceName(video.path, directory),
    subtitle_en_file_id: en?.id ?? null, subtitle_en_name: en ? sourceName(en.path, directory) : null,
    subtitle_zh_file_id: zh?.id ?? null, subtitle_zh_name: zh ? sourceName(zh.path, directory) : null,
    file_fingerprints: files,
  })
  if (insertError) throw insertError
}

function subtitleNameMatch(videoStem: string, name: string): { language: TheaterLanguage | null } | null {
  const stem = name.replace(/\.(srt|vtt|ass)$/i, '').normalize('NFKC').toLowerCase().trim()
  if (stem === videoStem) return { language: null }
  if (!stem.startsWith(videoStem)) return null
  const suffix = stem.slice(videoStem.length)
  const separator = /^[. _(\[【-]+/.exec(suffix)
  if (!separator) return null
  const label = suffix.slice(separator[0].length).replace(/\.(?:baidu-ai|rosie-asr)(?:\.[a-f0-9]{16})?$/, '')
    .replace(/[)\]】 ]+$/, '').replace(/_/g, '-')
  if (/^(en(?:-(?:us|gb|uk))?|eng|english|英文(?:字幕)?|英语(?:字幕)?)$/.test(label))
    return { language: 'en' }
  if (/^(zh(?:-(?:cn|tw|hk|hans|hant))?|cn|chs|cht|sc|tc|zho|chi|chinese|(?:简体|繁体)?中文(?:字幕)?|简体|繁体|简中|繁中)$/.test(label))
    return { language: 'zh' }
  if (/^(双语(?:字幕)?|中英(?:双语)?|中英字幕|英中|双字|bilingual|original|en-zh|zh-en|chs-eng)$/.test(label))
    return { language: null }
  return null
}

export async function readTheaterGenerationSource(account: Account, input: { directoryId: string; videoId: string }) {
  const root = await readTheaterDirectory(account, input.directoryId)
  const file = await readBaiduFileMetadata(input.videoId, account.accessToken)
  if (!file || !withinTheaterRoot(file.path, root) || file.path === root) throw Error('theater_invalid_source')
  const directory = file.path.slice(0, file.path.lastIndexOf('/')) || '/'
  const video = checkSource(file, directory, theaterVideoExtension)
  return { root, directory, video }
}

export async function matchTheaterSubtitles(account: Account, input: {
  directoryId: string
  videoId: string
}, signal: AbortSignal): Promise<TheaterSubtitleMatchResult> {
  const { root, directory, video } = await readTheaterGenerationSource(account, input)
  const videoStem = theaterVideoStem(sourceName(video.path, directory)).normalize('NFKC').toLowerCase().trim()
  const candidates: Pick<MatchedTheaterSubtitle, 'language' | 'fileId' | 'name'>[] = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    if (offset >= 10_000) throw Error('theater_directory_too_large')
    const entries = await readBaiduDirectoryPage(account.accessToken, directory, offset, pageSize, signal)
    for (const entry of entries) {
      if (entry.isdir !== 0 || typeof entry.path !== 'string' || !entry.path.startsWith(prefixFor(directory)) ||
          isPrivateProjectPath(entry.path)) continue
      const name = sourceName(entry.path, directory)
      if (name.includes('/') || !subtitlePattern.test(name)) continue
      const match = subtitleNameMatch(videoStem, name)
      if (match) candidates.push({ fileId: exactBaiduId(entry.fs_id), name, language: match.language })
    }
    if (entries.length < pageSize) break
  }

  // The provider may return a repeated row if the folder changes during paging.
  const unique = [...new Map(candidates.map(candidate => [candidate.fileId, candidate])).values()]
  const previews = unique.slice(0, 8)
  const outcomes = await Promise.allSettled(previews.map(async (candidate): Promise<MatchedTheaterSubtitle> => {
    const file = checkSource(await readBaiduFileMetadata(candidate.fileId, account.accessToken), directory, subtitlePattern)
    if (file.path !== prefixFor(directory) + candidate.name) throw Error('theater_file_missing')
    const cues = await subtitleFile(account, directory, file.id, candidate.name, fingerprintOf(file), signal)
    return { ...candidate, cueCount: cues.length, preview: cues[0].text.slice(0, 180) }
  }))
  signal.throwIfAborted()
  await requireCurrentTheaterAccount(account)
  const [currentDirectory, currentVideo] = await Promise.all([
    readTheaterDirectory(account, input.directoryId),
    readBaiduFileMetadata(video.id, account.accessToken),
  ])
  if (currentDirectory !== root) throw Error('theater_conflict')
  if (!currentVideo || currentVideo.path !== video.path || currentVideo.size !== video.size ||
      currentVideo.md5 !== video.md5 || currentVideo.modifiedAt !== video.modifiedAt) throw Error('theater_file_missing')
  signal.throwIfAborted()

  const tracks = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? [outcome.value] : [])
  const suggested: TheaterSubtitleMatchResult['suggested'] = {}
  for (const language of theaterSubtitleLanguages) {
    const options = unique.filter(candidate => candidate.language === language)
    if (options.length !== 1) continue
    const verified = tracks.find(track => track.fileId === options[0].fileId)
    if (verified) suggested[language] = verified.fileId
  }
  return {
    tracks,
    suggested,
    failedCount: previews.length - tracks.length,
    remainingCount: unique.length - previews.length,
  }
}

export async function setTheaterPublication(account: Account, id: string, revision: string, published: boolean) {
  if (published) {
    const { data, error } = await scopedFilms(account).eq('id', id).eq('revision', revision).maybeSingle()
    if (error) throw error
    const film = data as FilmRow | null
    if (!film) throw Error('theater_conflict')
    if (!await directoryStillBound(account, film)) throw Error('theater_file_missing')
    const sources = [
      ['video', film.video_file_id, film.video_name],
      ['playback', film.playback_file_id, film.playback_name],
      ['en', film.subtitle_en_file_id, film.subtitle_en_name],
      ['zh', film.subtitle_zh_file_id, film.subtitle_zh_name],
    ] as const
    await Promise.all(sources.map(async ([kind, fileId, name]) => {
      if (!fileId || !name) return
      const file = await readBaiduFileMetadata(fileId, account.accessToken)
      const expected = film.file_fingerprints[kind]
      if (!file || !expected || file.path !== prefixFor(film.directory_path) + name ||
          file.size !== expected.size || file.md5 !== expected.md5 || file.modifiedAt !== expected.modifiedAt)
        throw Error('theater_file_missing')
    }))
  }
  const { data, error } = await filmTable().update({ published, revision: crypto.randomUUID() })
    .eq('account_id', account.accountId).eq('account_generation', account.generation).eq('id', id)
    .eq('revision', revision).select('id').maybeSingle()
  if (error?.code === '23505') throw Error('theater_duplicate')
  if (error) throw error
  if (!data) throw Error('theater_conflict')
}

export async function findTheaterPlaybackCopy(account: Account, directory: string, videoName: string) {
  const name = theaterPlaybackCopyName(videoName)
  const path = prefixFor(directory) + name
  const entry = await findProjectFile(account.accessToken, path)
  if (!entry) return null
  const copy = checkSource(await readBaiduFileMetadata(exactBaiduId(entry.fs_id), account.accessToken), directory, /\.mp4$/i)
  if (copy.path !== path) throw Error('theater_playback_copy_missing')
  return { copy, name }
}

export async function attachTheaterPlaybackCopy(account: Account, id: string, revision: string) {
  const { data, error } = await scopedFilms(account).eq('id', id).eq('revision', revision).maybeSingle()
  if (error) throw error
  const film = data as FilmRow | null
  if (!film) throw Error('theater_conflict')
  const format = theaterVideoFormat(film.video_name)
  if (!film.directory_id || (format !== 'mkv' && format !== 'rmvb') || !await directoryStillBound(account, film))
    throw Error('theater_invalid_source')
  const result = await findTheaterPlaybackCopy(account, film.directory_path, film.video_name)
  if (!result) throw Error('theater_playback_copy_missing')
  const { copy, name } = result
  await requireCurrentTheaterAccount(account)
  if (!await directoryStillBound(account, film)) throw Error('theater_invalid_source')
  const updated = await filmTable().update({
    playback_file_id: copy.id, playback_name: name,
    file_fingerprints: { ...film.file_fingerprints, playback: fingerprintOf(copy) }, revision: crypto.randomUUID(),
  }).eq('account_id', account.accountId).eq('account_generation', account.generation)
    .eq('id', id).eq('revision', revision).select('id').maybeSingle()
  if (updated.error) throw updated.error
  if (!updated.data) throw Error('theater_conflict')
}

export async function streamTheaterFilm(filmId: string, range: string | null, signal: AbortSignal, playbackCopy = false) {
  const source = await publishedFilm(filmId)
  if (!source) return null
  const { account, film } = source
  const id = playbackCopy ? film.playback_file_id : film.video_file_id
  const name = playbackCopy ? film.playback_name : film.video_name
  const fingerprint = film.file_fingerprints[playbackCopy ? 'playback' : 'video']
  const format = name ? theaterVideoFormat(name) : undefined
  if (!id || !name || !fingerprint || !format || format === 'rmvb') return null
  const upstream = await fetchBaiduFileById(id, film.directory_path, range, signal, 'video', account.accessToken,
    prefixFor(film.directory_path) + name, fingerprint, 'published', 120_000, theaterVideoExtension)
  return upstream ? { upstream, contentType: theaterVideoMime[format] } : null
}

export async function readTheaterHlsContext(filmId: string) {
  const source = await publishedFilm(filmId)
  if (!source || theaterVideoFormat(source.film.video_name) === 'mp4') return null
  const { account, film } = source
  const expected = film.file_fingerprints.video
  if (!expected) return null
  return {
    filmId, revision: film.revision, accountGeneration: account.generation, token: account.accessToken,
    videoId: film.video_file_id, path: prefixFor(film.directory_path) + film.video_name, expected,
  }
}

export const readTheaterSubtitleSource = publishedFilm
export type TheaterSubtitleSource = NonNullable<Awaited<ReturnType<typeof readTheaterSubtitleSource>>>

export function theaterSubtitleBindings(film: FilmRow, language: TheaterLanguage) {
  const id = language === 'en' ? film.subtitle_en_file_id : film.subtitle_zh_file_id
  const name = language === 'en' ? film.subtitle_en_name : film.subtitle_zh_name
  const fingerprint = film.file_fingerprints[language]
  return id && name && fingerprint ? { id, name, fingerprint, path: prefixFor(film.directory_path) + name } : null
}

export async function verifyTheaterSubtitleFilm({ film, account }: TheaterSubtitleSource) {
  await requireCurrentTheaterAccount(account)
  const { data, error } = await scopedFilms(account).eq('id', film.id).eq('revision', film.revision)
    .eq('published', true).maybeSingle()
  if (error) throw error
  if (!data || !await directoryStillBound(account, film)) throw Error('theater_subtitle_source_conflict')
}
