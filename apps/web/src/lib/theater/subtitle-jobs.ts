import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminSupabase } from '../api-auth'
import { exactBaiduId } from '../baidu-identity'
import { readBaiduFileMetadata, type BaiduFileMetadata } from '../baidu-media'
import { findProjectFile, putProjectObject } from '../baidu-project-transfer.mjs'
import { getBaiduAccountContext } from '../baidu-token'
import { findTheaterPlaybackCopy, readTheaterGenerationSource } from '../baidu-theater'
import {
  downloadTheaterTranscription, queryTheaterTranscription, serializeTheaterSrt, submitTheaterTranscription,
  theaterAsrConfig, theaterAsrMaxBytes,
} from './file-transcription'
import { signedTheaterSource, theaterWorkerOrigin, theaterWorkerSigningKey } from './subtitle-worker-auth'
import { maxSubtitleBytes, parseTheaterSubtitles } from './subtitle-timeline'
import { theaterVideoFormat, theaterVideoStem, type MatchedTheaterSubtitle, type TheaterSubtitleJob,
  type TheaterSubtitleJobState } from './types'

type Account = Awaited<ReturnType<typeof getBaiduAccountContext>>
type Db = ReturnType<typeof createAdminSupabase>
type Selection = { directoryId: string; videoId: string }
type State = TheaterSubtitleJobState | 'submitting'
type JobRow = {
  id: string
  account_id: string
  account_generation: string
  directory_id: string | null
  directory_path: string
  video_id: string
  video_path: string
  video_size: number
  video_md5: string | null
  video_modified_at: number | null
  transcription_copy: BaiduFileMetadata | null
  state: State
  provider_task_id: string | null
  source_expires_at: number | null
  attempts: number
  lease_id: string | null
  error_code: string | null
  subtitle: MatchedTheaterSubtitle | null
}

const table = (db: Db) => db.from('theater_subtitle_jobs')
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

const errors: Record<string, string> = {
  worker_not_configured: '当前环境未配置字幕后台或百炼异步转写。',
  theater_worker_origin_conflict: '字幕后台已绑定另一个站点，请在原站点继续。',
  video_too_large: '百炼整片转写的输入上限为 2 GB。可填写百度网盘分享链接，直接获取已有字幕。',
  video_requires_playback_copy: 'RMVB 生成字幕需要同目录的 .playback.mp4，也可导入网盘字幕或手动选择。',
  theater_file_missing: '影片已移动或替换，请重新选择影片。',
  theater_invalid_source: '影片目录已变更，请重新选择影片。',
  baidu_account_changed: '网盘授权已变更，请重新选片。',
  baidu_not_authorized: '请先授权共享百度网盘。',
  baidu_reauthorize: '网盘授权已过期，请重新授权后重试。',
  provider_rejected: '百炼拒绝了转写请求，请核对模型权限和账户额度。',
  provider_failed: '百炼未能完成转写，请核对视频能否播放后重试。',
  provider_result_expired: '百炼转写结果已过期，请重新生成。',
  provider_unavailable: '暂时无法查询百炼转写结果。',
  provider_result_address: '百炼返回了无法读取的字幕结果。',
  submission_unknown: '百炼未返回任务编号。请先核对百炼的任务记录，避免重复提交。',
  subtitle_no_speech: '转写没有返回可用的带时间码对白。',
  subtitle_too_large: '生成的字幕超出电影剧场可读取的大小。',
  write_failed: '字幕已转写，写回网盘失败，可重试保存。',
}

export function theaterSubtitleJobError(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  return errors[code] ?? '暂时无法处理字幕任务，请稍后重试。'
}

function publicJob(job: JobRow): TheaterSubtitleJob {
  return {
    id: job.id, state: job.state === 'submitting' ? 'transcribing' : job.state,
    subtitle: job.subtitle,
    message: job.error_code ? errors[job.error_code] ?? errors.provider_unavailable : null,
  }
}

export async function ensureTheaterSubtitleJob(account: Account, selection: Selection, actor: string): Promise<TheaterSubtitleJob> {
  const { directory, video } = await readTheaterGenerationSource(account, selection)
  const format = theaterVideoFormat(video.path)
  const copy = format === 'rmvb' || video.size > theaterAsrMaxBytes
    ? (await findTheaterPlaybackCopy(account, directory, video.path.slice(video.path.lastIndexOf('/') + 1)))?.copy
    : undefined
  if (format === 'rmvb' && !copy) throw Error('video_requires_playback_copy')
  const sourceKey = sha(JSON.stringify([
    account.accountId, account.generation, selection.directoryId, video.id,
    video.path, video.size, video.md5, video.modifiedAt,
    ...(copy ? [copy.id, copy.path, copy.size, copy.md5, copy.modifiedAt] : []),
  ]))
  const db = createAdminSupabase()
  const { data: existing, error: fetchError } = await table(db).select('*').eq('source_key', sourceKey).maybeSingle()
  if (fetchError) throw fetchError
  if (existing) {
    const job = existing as JobRow
    if (job.state !== 'ready' || !job.subtitle) return publicJob(job)
    const file = await readBaiduFileMetadata(job.subtitle.fileId, account.accessToken)
    const prefix = directory === '/' ? '/' : directory + '/'
    if (file?.path === prefix + job.subtitle.name) return publicJob(job)
    const { data, error } = await table(db).update({
      state: 'failed', error_code: 'write_failed', subtitle: null, updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('state', 'ready').select('*').maybeSingle()
    if (error) throw error
    if (data) return publicJob(data as JobRow)
    const current = await readTheaterSubtitleJob(account, job.id)
    if (!current) throw Error('theater_file_missing')
    return current
  }
  if ((copy ?? video).size > theaterAsrMaxBytes) throw Error('video_too_large')
  const origin = theaterWorkerOrigin()
  const signingKey = theaterWorkerSigningKey()
  if (!origin || !signingKey || !theaterAsrConfig()) throw Error('worker_not_configured')

  const { error: configError } = await db.rpc('configure_theater_subtitle_worker', {
    p_origin: origin, p_signing_key: signingKey,
  })
  if (configError) throw Error(configError.message === 'theater_worker_origin_conflict'
    ? configError.message : 'worker_not_configured')
  const { error } = await table(db).upsert({
    source_key: sourceKey, account_id: account.accountId, account_generation: account.generation,
    directory_id: selection.directoryId, directory_path: directory, video_id: video.id, video_path: video.path,
    video_size: video.size, video_md5: video.md5, video_modified_at: video.modifiedAt, requested_by: actor,
    transcription_copy: copy ?? null,
  }, { onConflict: 'source_key', ignoreDuplicates: true })
  if (error) throw error
  const stored = await table(db).select('*').eq('source_key', sourceKey).single()
  if (stored.error) throw stored.error
  return publicJob(stored.data as JobRow)
}

export async function readTheaterSubtitleJob(account: Account, id: string, retry = false): Promise<TheaterSubtitleJob | null> {
  const db = createAdminSupabase()
  const { data, error } = await table(db).select('*').eq('id', id).eq('account_id', account.accountId)
    .eq('account_generation', account.generation).maybeSingle()
  if (error) throw error
  const job = data as JobRow | null
  if (!job) return null
  if (!retry || job.state !== 'failed') return publicJob(job)
  const reuse = job.provider_task_id && ['write_failed', 'provider_unavailable'].includes(job.error_code ?? '')
  const { data: next, error: retryError } = await table(db).update({
    state: reuse ? 'writing' : 'queued', provider_task_id: reuse ? job.provider_task_id : null,
    source_expires_at: null, attempts: 0, error_code: null, lease_id: null, lease_until: null,
    next_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id).eq('state', 'failed').eq('account_generation', account.generation).select('*').maybeSingle()
  if (retryError) throw retryError
  return next ? publicJob(next as JobRow) : readTheaterSubtitleJob(account, id)
}

async function verifyJobSource(job: JobRow) {
  const account = await getBaiduAccountContext()
  if (account.accountId !== job.account_id || account.generation !== job.account_generation)
    throw Error('baidu_account_changed')
  if (!job.directory_id) throw Error('theater_invalid_source')
  const { directory, video } = await readTheaterGenerationSource(account, { directoryId: job.directory_id, videoId: job.video_id })
  if (directory !== job.directory_path || video.path !== job.video_path || video.size !== job.video_size ||
      video.md5 !== job.video_md5 || video.modifiedAt !== job.video_modified_at) throw Error('theater_file_missing')
  return { account, directory, video }
}

export async function readTheaterSubtitleSource(id: string, expiry: number) {
  const { data, error } = await table(createAdminSupabase()).select('*').eq('id', id)
    .eq('source_expires_at', expiry).in('state', ['submitting', 'transcribing']).maybeSingle()
  if (error) throw error
  return data ? readJobTranscriptionMedia(data as JobRow) : null
}

async function readJobTranscriptionMedia(job: JobRow) {
  const source = await verifyJobSource(job)
  const copy = job.transcription_copy
  if (!copy) return source
  const current = await readBaiduFileMetadata(copy.id, source.account.accessToken)
  if (!current || current.path !== copy.path || current.size !== copy.size || current.md5 !== copy.md5 ||
      current.modifiedAt !== copy.modifiedAt) throw Error('theater_file_missing')
  return { ...source, video: current }
}

async function advance(db: Db, job: JobRow, values: Partial<JobRow> & { next_run_at?: string }, release = true) {
  if (!job.lease_id) throw Error('subtitle_job_not_claimed')
  const data = { ...values, updated_at: new Date().toISOString(),
    ...(release ? { lease_id: null, lease_until: null } : {}) }
  const { error } = await table(db).update(data).eq('id', job.id).eq('lease_id', job.lease_id).eq('state', job.state)
    .select('id').single()
  if (error) throw error
}

const after = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()
const sourceError = new Set(['theater_file_missing', 'theater_invalid_source', 'baidu_account_changed', 'baidu_not_authorized', 'baidu_reauthorize'])
const resultError = new Set(['provider_failed', 'provider_result_expired', 'provider_result_address', 'subtitle_no_speech', 'subtitle_too_large'])

async function handleFailure(db: Db, job: JobRow, error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : ''
  if (sourceError.has(code) || resultError.has(code)) {
    await advance(db, job, { state: 'failed', error_code: code })
  } else {
    const attempts = job.attempts + 1
    await advance(db, job, {
      attempts, state: attempts >= 4 ? 'failed' : job.state,
      next_run_at: after(Math.min(240, 30 * 2 ** attempts)), error_code: attempts >= 4 ? fallback : null,
    })
  }
}

async function storeCaption(job: JobRow, resultUrl: string): Promise<MatchedTheaterSubtitle> {
  const { cues, language } = await downloadTheaterTranscription(resultUrl)
  const bytes = serializeTheaterSrt(cues)
  if (bytes.length > maxSubtitleBytes) throw Error('subtitle_too_large')
  const preview = parseTheaterSubtitles(bytes.toString('utf8'), 'generated.srt')
  const { account, directory, video } = await verifyJobSource(job)
  const prefix = directory === '/' ? '/' : directory + '/'
  const stem = Array.from(theaterVideoStem(video.path.slice(prefix.length))
    .replace(/[\\/"<>|:*?\x00-\x1f\x7f]/g, '_').trim())
    .slice(0, 42).join('').replace(/[. ]+$/, '') || 'video'
  const name = stem + '.' + (language ?? 'original') + '.rosie-asr.' + sha(bytes).slice(0, 16) + '.srt'
  const path = prefix + name
  await putProjectObject(account.accessToken, path, bytes, { verify: true })
  const stored = await findProjectFile(account.accessToken, path)
  if (!stored) throw Error('subtitle_write_unconfirmed')
  return { language, fileId: exactBaiduId(stored.fs_id), name, cueCount: preview.length, preview: preview[0].text.slice(0, 180) }
}

export async function processTheaterSubtitleJob(origin: string) {
  const config = theaterAsrConfig()
  if (!config) throw Error('worker_not_configured')
  const db = createAdminSupabase()
  const { data, error } = await db.rpc('claim_theater_subtitle_job')
  if (error) throw error
  const job = (data as JobRow[] | null)?.[0]
  if (!job) return false

  if (job.state === 'submitting') {
    await advance(db, job, { state: 'submission_unknown', error_code: 'submission_unknown', source_expires_at: null })
    return true
  }

  if (job.state === 'queued') {
    let format: 'mp4' | 'mkv'
    try {
      const { video } = await readJobTranscriptionMedia(job)
      const sourceFormat = theaterVideoFormat(video.path)
      if (sourceFormat !== 'mp4' && sourceFormat !== 'mkv') throw Error('theater_invalid_source')
      format = sourceFormat
    } catch (error) {
      await handleFailure(db, job, error, 'theater_file_missing')
      return true
    }
    const expiry = Math.floor(Date.now() / 1000) + 2 * 60 * 60
    const source = signedTheaterSource(origin, job.id, expiry, format)
    await advance(db, job, { state: 'submitting', attempts: 0, source_expires_at: expiry }, false)
    job.state = 'submitting'
    let taskId: string
    try {
      taskId = await submitTheaterTranscription(config, source)
    } catch (error) {
      const rejected = error instanceof Error && error.message === 'provider_rejected'
      await advance(db, job, {
        state: rejected ? 'failed' : 'submission_unknown', error_code: rejected ? 'provider_rejected' : 'submission_unknown',
        source_expires_at: null,
      })
      return true
    }
    await advance(db, job, { state: 'transcribing', provider_task_id: taskId, next_run_at: after(30) })
    return true
  }

  let caption: MatchedTheaterSubtitle
  try {
    if (!job.provider_task_id) throw Error('provider_result_expired')
    const result = await queryTheaterTranscription(config, job.provider_task_id)
    if (!result) {
      await advance(db, job, { next_run_at: after(50), attempts: 0 })
      return true
    }
    if (job.state !== 'writing') {
      await advance(db, job, { state: 'writing', source_expires_at: null, attempts: 0 }, false)
      job.state = 'writing'
      job.attempts = 0
    }
    caption = await storeCaption(job, result)
  } catch (error) {
    await handleFailure(db, job, error, job.state === 'writing' ? 'write_failed' : 'provider_unavailable')
    return true
  }
  await advance(db, job, { state: 'ready', subtitle: caption, source_expires_at: null, error_code: null })
  return true
}
