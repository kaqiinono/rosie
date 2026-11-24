import 'server-only'

import type { SubtitleCue, TheaterLanguage } from './types'

const maxResultBytes = 16 * 1024 * 1024
export const theaterAsrMaxBytes = 2_000_000_000
export const theaterAsrMaxDurationMs = 12 * 60 * 60 * 1000

export function theaterAsrConfig() {
  const base = process.env.THEATER_ASR_BASE_URL ?? process.env.AI_STT_BASE_URL ?? process.env.AI_EMBED_BASE_URL
  const key = process.env.THEATER_ASR_API_KEY ?? process.env.AI_STT_API_KEY ?? process.env.AI_EMBED_API_KEY
  if (!base || !key) return null
  try {
    const url = new URL(base)
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password &&
        /^(?:[a-z0-9-]+\.[a-z0-9-]+\.maas|dashscope(?:-intl)?)\.aliyuncs\.com$/.test(url.hostname))
      return { origin: url.origin, key }
  } catch { /* No compatible DashScope endpoint is configured. */ }
  return null
}

type AsrConfig = NonNullable<ReturnType<typeof theaterAsrConfig>>
type Json = Record<string, unknown>

function object(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}
}

export async function submitTheaterTranscription(config: AsrConfig, sourceUrl: string) {
  const response = await fetch(config.origin + '/api/v1/services/audio/asr/transcription', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
    body: JSON.stringify({
      model: 'qwen3-asr-flash-filetrans', input: { file_url: sourceUrl }, parameters: { enable_words: false },
    }),
    signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store',
  })
  if (response.status >= 400 && response.status < 500) {
    await response.body?.cancel()
    throw Error('provider_rejected')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw Error('submission_unknown')
  }
  const output = object(object(await response.json()).output)
  if (output.task_status === 'FAILED') throw Error('provider_rejected')
  if (typeof output.task_id !== 'string' || !/^[a-z0-9_-]{1,120}$/i.test(output.task_id))
    throw Error('submission_unknown')
  return output.task_id
}

export async function queryTheaterTranscription(config: AsrConfig, taskId: string) {
  const response = await fetch(config.origin + '/api/v1/tasks/' + encodeURIComponent(taskId), {
    headers: { Authorization: 'Bearer ' + config.key },
    signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store',
  })
  if (response.status === 404) {
    await response.body?.cancel()
    throw Error('provider_result_expired')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw Error('provider_unavailable')
  }
  const output = object(object(await response.json()).output)
  if (output.task_status === 'PENDING' || output.task_status === 'RUNNING') return null
  if (output.task_status === 'FAILED' || output.task_status === 'CANCELED') throw Error('provider_failed')
  if (output.task_status === 'UNKNOWN') throw Error('provider_result_expired')
  const result = object(output.result)
  if (output.task_status !== 'SUCCEEDED' || typeof result.transcription_url !== 'string')
    throw Error('provider_unavailable')
  return result.transcription_url
}

async function readResult(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store' })
  if (response.status === 403 || response.status === 404) {
    await response.body?.cancel()
    throw Error('provider_result_expired')
  }
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxResultBytes) {
    await response.body?.cancel()
    throw Error('provider_unavailable')
  }
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxResultBytes) {
        await reader.cancel()
        throw Error('subtitle_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return object(JSON.parse(Buffer.concat(chunks).toString('utf8')))
}

export async function downloadTheaterTranscription(resultUrl: string) {
  const url = new URL(resultUrl)
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !/(^|\.)oss(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(url.hostname))
    throw Error('provider_result_address')
  const result = await readResult(url)
  const channels = Array.isArray(result.transcripts) ? result.transcripts.map(object) : []
  const first = channels.find(channel => channel.channel_id === 0) ?? channels[0]
  const sentences = Array.isArray(first?.sentences) ? first.sentences.map(object) : []
  if (!sentences.length) throw Error('subtitle_no_speech')

  const languages = new Set<TheaterLanguage | null>()
  const cues = sentences.flatMap(sentence => {
    const startMs = sentence.begin_time
    const endMs = sentence.end_time
    const text = typeof sentence.text === 'string' ? sentence.text.trim().slice(0, 1800) : ''
    if (typeof startMs !== 'number' || typeof endMs !== 'number' || !Number.isInteger(startMs) ||
        !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs || endMs > theaterAsrMaxDurationMs || !text)
      return []
    const code = typeof sentence.language === 'string' ? sentence.language.toLowerCase().split(/[-_]/)[0] : ''
    if (code) languages.add(code === 'en' ? 'en' : ['zh', 'yue', 'cmn'].includes(code) ? 'zh' : null)
    return [{ startMs, endMs, text }]
  })
  if (!cues.length) throw Error('subtitle_no_speech')
  if (cues.length > 12_000) throw Error('subtitle_too_large')
  const language = languages.size === 1 ? Array.from(languages)[0] : null
  return { language, cues: cues.sort((first, second) => first.startMs - second.startMs || first.endMs - second.endMs) }
}

function srtTime(ms: number) {
  return new Date(ms).toISOString().slice(11, 23).replace('.', ',')
}

export function serializeTheaterSrt(cues: SubtitleCue[]) {
  const blocks = cues.map((cue, index) => [
    index + 1,
    srtTime(cue.startMs) + ' --> ' + srtTime(cue.endMs),
    cue.text.replace(/\r\n?/g, '\n').replace(/\n[ \t]*\n+/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  ].join('\n'))
  return Buffer.from(blocks.join('\n\n') + '\n', 'utf8')
}
