import 'server-only'

import { isDeepStrictEqual } from 'node:util'
import { baiduAuthErrorCode } from '@rosie/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamMediaGrant, ExamMediaVerification, MediaSlot } from '@rosie/exams'
import { validateExamDraft, type ExamDraftInput } from '@rosie/exams/validation'
import { fetchBaiduFileById, type BaiduFileFingerprint } from '@/lib/baidu-media'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { ExamApiError } from './http'
import { examMediaParts } from './mediaParts'

export const EXAM_MEDIA_COOKIE = 'rosie_exam_media_session'
export const EXAM_MEDIA_COOKIE_PATH = '/api/exams/media'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface StoredExamMediaFile {
  slot_id: string
  slot: MediaSlot
  directory_id?: string
  file_id: string
  path: string
  size: number
  md5: string | null
  modified_at: number | null
  reviewed: boolean
  duration_ms: number | null
}

export interface StoredExamMediaBinding {
  id: string
  content_revision_id: string
  account_id: string
  account_generation: string
  directory_id: string
  main_path: string
  files: StoredExamMediaFile[]
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_media_unavailable', 503)
  return value as Record<string, unknown>
}

export function validExamMediaPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && Buffer.byteLength(value, 'utf8') <= 2048
    && !/[\\\x00-\x1f\x7f]|%(?:25|2e|2f|5c)/i.test(value)
    && (value === '/' || value.slice(1).split('/').every(part => part && part !== '.' && part !== '..'))
}

export function withinExamDirectory(path: string, directory: string): boolean {
  return path.startsWith(directory === '/' ? '/' : directory + '/')
}

export function examMediaMime(slot: MediaSlot, path: string): string | null {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (['exam_listening', 'training_audio', 'speaking_example', 'examiner_audio'].includes(slot.purpose)) {
    const audio: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg' }
    return audio[extension] ?? null
  }
  if (slot.audience === 'admin' && slot.purpose === 'source_page' && extension === 'pdf') return 'application/pdf'
  const images: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
  return images[extension] ?? null
}

export async function readExamMediaDraft(db: SupabaseClient, id: string): Promise<{ draft: ExamDraftInput; version: string; status: string }> {
  const { data, error } = await db.rpc('read_exam_publication', { p_id: id })
  if (error) throw new ExamApiError(error.message === 'exam_not_found' ? 'exam_not_found' : 'exam_media_unavailable', error.message === 'exam_not_found' ? 404 : 503)
  const row = object(data)
  const draft = object(row.draft)
  const content = object(draft.content)
  if (row.id !== id || typeof row.version !== 'string' || !UUID.test(row.version)
    || (row.status !== 'draft' && row.status !== 'published' && row.status !== 'withdrawn') || content.status !== row.status) {
    throw new ExamApiError('exam_media_unavailable', 503)
  }
  const validated = validateExamDraft({ ...draft, content: { ...content, status: 'draft' } })
  if (!validated.ok || validated.value.content.id !== id) throw new ExamApiError('exam_media_unavailable', 503)
  return { draft: validated.value, version: row.version, status: row.status }
}

export async function readExamMediaBinding(db: SupabaseClient, revisionId: string, bindingId: string): Promise<StoredExamMediaBinding> {
  if (!UUID.test(bindingId)) throw new ExamApiError('exam_media_binding_missing', 409)
  const { data, error } = await db.from('exam_media_binding_revisions')
    .select('id,content_revision_id,account_id,account_generation,directory_id,main_path,files')
    .eq('id', bindingId).eq('content_revision_id', revisionId).maybeSingle()
  if (error) throw new ExamApiError('exam_media_unavailable', 503)
  if (!data) throw new ExamApiError('exam_media_binding_missing', 409)
  const row = object(data)
  if (row.id !== bindingId || row.content_revision_id !== revisionId || typeof row.account_id !== 'string'
    || typeof row.account_generation !== 'string' || !UUID.test(row.account_generation)
    || typeof row.directory_id !== 'string' || !UUID.test(row.directory_id) || !validExamMediaPath(row.main_path)
    || !Array.isArray(row.files)) throw new ExamApiError('exam_media_unavailable', 503)
  const seen = new Set<string>()
  const files = (row.files as unknown[]).map(value => {
    const file = object(value)
    const slot = object(file.slot)
    if (typeof file.slot_id !== 'string' || seen.has(file.slot_id) || typeof file.file_id !== 'string' || !/^[1-9]\d{0,19}$/.test(file.file_id)
      || !validExamMediaPath(file.path)
      || (file.directory_id === undefined ? !withinExamDirectory(file.path, row.main_path as string)
        : typeof file.directory_id !== 'string' || !UUID.test(file.directory_id)
          || (slot.purpose !== 'exam_listening' && slot.purpose !== 'training_audio'))
      || typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size <= 0 || typeof file.reviewed !== 'boolean'
      || (file.md5 !== null && (typeof file.md5 !== 'string' || !/^[0-9a-f]{32}$/.test(file.md5)))
      || (file.modified_at !== null && (typeof file.modified_at !== 'number' || !Number.isSafeInteger(file.modified_at) || file.modified_at <= 0))
      || (file.duration_ms !== null && (typeof file.duration_ms !== 'number' || !Number.isSafeInteger(file.duration_ms) || file.duration_ms <= 0 || file.duration_ms > 86_400_000))
      || (file.md5 === null && file.modified_at === null)) throw new ExamApiError('exam_media_unavailable', 503)
    seen.add(file.slot_id)
    return file as unknown as StoredExamMediaFile
  })
  return { id: bindingId, content_revision_id: revisionId, account_id: row.account_id,
    account_generation: row.account_generation, directory_id: row.directory_id, main_path: row.main_path, files }
}

async function bindingAccount(db: SupabaseClient, binding: StoredExamMediaBinding, files: readonly StoredExamMediaFile[]) {
  const account = await getBaiduAccountContext()
  if (account.accountId !== binding.account_id || account.generation !== binding.account_generation) throw new ExamApiError('baidu_account_changed', 409)
  const ids = [...new Set(files.map(file => file.directory_id ?? binding.directory_id))]
  if (!ids.length) return account
  const { data, error } = await db.from('baidu_sync_directories').select('id,path').eq('account_id', account.accountId).in('id', ids)
  if (error) throw new ExamApiError('exam_media_unavailable', 503)
  const roots = new Map(data.map(root => [root.id, root.path]))
  if (files.some(file => {
    const root = roots.get(file.directory_id ?? binding.directory_id)
    if (typeof root !== 'string') return true
    return file.directory_id ? !withinExamDirectory(file.path, root)
      : binding.main_path !== root && !withinExamDirectory(binding.main_path, root)
  })) {
    throw new ExamApiError('exam_media_binding_changed', 409, [{
      path: '$.content.mediaBindingRevisionId', code: 'exam_media_directory_changed',
      message: '考试资源主目录已失效。请联系管理员在同步管理中重新选择授权目录。',
    }])
  }
  return account
}

function fingerprint(file: StoredExamMediaFile): BaiduFileFingerprint {
  return { size: file.size, md5: file.md5, modifiedAt: file.modified_at }
}

async function streamFile(file: StoredExamMediaFile, token: string, range: string | null, signal: AbortSignal) {
  const directory = file.path.slice(0, file.path.lastIndexOf('/')) || '/'
  const mime = examMediaMime(file.slot, file.path)
  if (!mime) throw new ExamApiError('exam_invalid_media_binding', 409)
  const response = await fetchBaiduFileById(file.file_id, directory, range, signal,
    mime.startsWith('audio/') ? 'audio' : 'material', token, file.path, fingerprint(file))
  if (!response) throw new ExamApiError('exam_media_file_missing', 409)
  return { response, mime }
}

export async function verifyExamMediaForPublication(db: SupabaseClient, draft: ExamDraftInput): Promise<ExamMediaVerification | undefined> {
  const slots = [...draft.content.mediaSlots, ...draft.solutions.mediaSlots].filter(slot => slot.required)
  if (!slots.length) return undefined
  const bindingId = draft.content.mediaBindingRevisionId
  if (!bindingId) return undefined
  const binding = await readExamMediaBinding(db, draft.content.id, bindingId)
  listeningDuration(draft, binding)
  const slotIds = new Set(slots.map(slot => slot.id))
  const account = await bindingAccount(db, binding, binding.files.filter(file => slotIds.has(file.slot_id)))
  const checked = new Set<string>()
  const verifiedSlotIds: string[] = []
  for (const slot of slots) {
    const file = binding.files.find(entry => entry.slot_id === slot.id)
    if (!file?.reviewed || !isDeepStrictEqual(file.slot, slot)) continue
    if (binding.files.some(sibling => sibling.file_id === file.file_id && sibling.slot.audience !== slot.audience)) {
      throw new ExamApiError('exam_media_scope_conflict', 409)
    }
    const fileKey = JSON.stringify([file.file_id, file.path, file.size, file.md5, file.modified_at])
    if (!checked.has(fileKey)) {
      const { response } = await streamFile(file, account.accessToken, 'bytes=0-0', AbortSignal.timeout(15_000))
      await response.body?.cancel()
      if (![200, 206].includes(response.status)) throw new ExamApiError('exam_media_file_missing', 409)
      checked.add(fileKey)
    }
    verifiedSlotIds.push(slot.id)
  }
  const current = await getBaiduAccountContext()
  if (current.accountId !== account.accountId || current.generation !== account.generation) throw new ExamApiError('baidu_account_changed', 409)
  return { bindingRevisionId: bindingId, verifiedSlotIds, checkedAt: new Date().toISOString() }
}

function slotInSection(slot: MediaSlot, draft: ExamDraftInput, sectionId?: string): boolean {
  if (!sectionId) return true
  if (slot.target.kind === 'group') return draft.content.groups.find(group => group.id === slot.target.id)?.sectionId === sectionId
  if (slot.target.kind === 'content_set') return slot.purpose !== 'exam_listening' || sectionId === 'listening'
  if (slot.target.kind === 'guidance') {
    const guidance = draft.content.guidance.find(item => item.id === slot.target.id)
    return Boolean(guidance?.groupIds.some(id => draft.content.groups.find(group => group.id === id)?.sectionId === sectionId))
  }
  return false
}

function attemptMediaSlotError(draft: ExamDraftInput, slot: MediaSlot<'student'>, code: string, reason: string) {
  const parts = examMediaParts(draft)
  const part = parts.find(item => item.slotIds.includes(slot.id))
  const assigned = new Set(parts.flatMap(item => item.slotIds))
  const slots = draft.content.mediaSlots.filter(item => part ? part.slotIds.includes(item.id) : !assigned.has(item.id))
  const kind = slot.purpose === 'question_image' ? '题图' : '音频'
  // Use position and type so the failure can be located without revealing unopened material or file paths.
  const location = `${part?.label ?? '整套共享资源'} 的第 ${slots.indexOf(slot) + 1} 个资源槽位（${kind}）`
  return new ExamApiError(code, 409, [{
    path: `$.content.mediaSlots[${draft.content.mediaSlots.indexOf(slot)}]`, code,
    message: `${location}${reason}。请联系管理员检查考试资源。`,
  }])
}

function listeningDuration(draft: ExamDraftInput, binding: StoredExamMediaBinding, sectionId?: string): number | null {
  const slots = draft.content.mediaSlots.filter(slot => slot.required && slot.purpose === 'exam_listening' && slotInSection(slot, draft, sectionId))
  if (!slots.length) return null
  let duration = 0
  for (const slot of slots) {
    const file = binding.files.find(item => item.slot_id === slot.id)
    const program = slot.playback
    const length = slot.segment ? slot.segment.endMs - slot.segment.startMs : file?.duration_ms
    if (!file?.reviewed || !isDeepStrictEqual(file.slot, slot) || !program || !length || !Number.isSafeInteger(length) || length <= 0
      || (slot.segment && file.duration_ms !== null && slot.segment.endMs > file.duration_ms)
      || (program.includesSourceRepetitions && (program.repeatCount !== 1 || program.waitAfterMs !== 0))) {
      throw attemptMediaSlotError(draft, slot, 'exam_listening_program_missing', '的时长或播放配置缺失或无效')
    }
    duration += length * program.repeatCount + program.waitAfterMs
    if (!Number.isSafeInteger(duration) || duration > 86_400_000) throw new ExamApiError('exam_listening_program_missing', 409)
  }
  return duration
}

/** Revalidate frozen student resources before starting an attempt or section. */
export async function verifyExamMediaForAttempt(
  db: SupabaseClient, draft: ExamDraftInput, bindingId: string, sectionId?: string, signal?: AbortSignal,
): Promise<{ listeningDurationMs: number | null }> {
  try {
    signal?.throwIfAborted()
    const slots = draft.content.mediaSlots.filter(slot => slot.required && slotInSection(slot, draft, sectionId))
    if (!slots.length) return { listeningDurationMs: null }
    if (draft.content.mediaBindingRevisionId !== bindingId) throw new ExamApiError('exam_media_binding_changed', 409)
    const binding = await abortableMediaRead(() => readExamMediaBinding(db, draft.content.id, bindingId), signal)
    const slotIds = new Set(slots.map(slot => slot.id))
    const account = await abortableMediaRead(() => bindingAccount(db, binding, binding.files.filter(file => slotIds.has(file.slot_id))), signal)
    const checked = new Set<string>()
    for (const slot of slots) {
      signal?.throwIfAborted()
      const file = binding.files.find(item => item.slot_id === slot.id)
      if (!file) throw attemptMediaSlotError(draft, slot, 'exam_media_binding_changed', '尚未绑定文件')
      if (!isDeepStrictEqual(file.slot, slot)) throw attemptMediaSlotError(draft, slot, 'exam_media_binding_changed', '的配置已变化，需要重新绑定')
      if (!file.reviewed) throw attemptMediaSlotError(draft, slot, 'exam_media_binding_changed', '的文件尚未核对')
      const key = JSON.stringify([file.file_id, file.path, file.size, file.md5, file.modified_at])
      if (!checked.has(key)) {
        const timeout = AbortSignal.timeout(15_000)
        try {
          const { response } = await streamFile(file, account.accessToken, 'bytes=0-0', signal ? AbortSignal.any([signal, timeout]) : timeout)
          await response.body?.cancel()
          if (![200, 206].includes(response.status)) throw new ExamApiError('exam_media_file_missing', 409)
        } catch (error) {
          if (error instanceof ExamApiError && error.code === 'exam_media_file_missing') {
            throw attemptMediaSlotError(draft, slot, error.code, '的网盘文件无法读取')
          }
          if (error instanceof ExamApiError && error.code === 'exam_invalid_media_binding') {
            throw attemptMediaSlotError(draft, slot, error.code, '绑定的文件类型不符合要求')
          }
          if (error instanceof Error && error.message === 'baidu_file_changed') {
            throw attemptMediaSlotError(draft, slot, 'exam_media_binding_changed', '的网盘文件已变化，需要重新绑定')
          }
          throw error
        }
        checked.add(key)
      }
    }
    const current = await abortableMediaRead(() => getBaiduAccountContext(), signal)
    if (current.accountId !== account.accountId || current.generation !== account.generation) throw new ExamApiError('baidu_account_changed', 409)
    return { listeningDurationMs: listeningDuration(draft, binding, sectionId) }
  } catch (error) {
    if (error instanceof ExamApiError) throw error
    const code = baiduAuthErrorCode(error)
    if (code) throw new ExamApiError(code, 409)
    throw new ExamApiError('exam_media_unavailable', 503)
  }
}

/** Bound a caller's wait without interrupting another request's shared OAuth lease. */
async function abortableMediaRead<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return read()
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new ExamApiError('exam_media_unavailable', 503))
    signal.addEventListener('abort', abort, { once: true })
    read().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export async function fetchExamBoundMedia(grant: ExamMediaGrant, range: string | null, signal: AbortSignal, db: SupabaseClient): Promise<Response> {
  if (grant.wholeFileAllowed !== true) throw new ExamApiError('forbidden', 403)
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) throw new ExamApiError('invalid_range', 416)
  const { draft } = await readExamMediaDraft(db, grant.contentRevisionId)
  if (draft.content.mediaBindingRevisionId !== grant.mediaBindingRevisionId) throw new ExamApiError('exam_media_binding_changed', 409)
  const slot = [...draft.content.mediaSlots, ...draft.solutions.mediaSlots].find(item => item.id === grant.slotId)
  if (!slot || (grant.audience !== 'admin' && slot.audience !== grant.audience)
    || (grant.audience !== 'admin' && slot.audience === 'admin')) throw new ExamApiError('forbidden', 403)
  const binding = await readExamMediaBinding(db, grant.contentRevisionId, grant.mediaBindingRevisionId)
  const file = binding.files.find(item => item.slot_id === slot.id)
  if (!file || !isDeepStrictEqual(file.slot, slot) || (grant.audience !== 'admin' && !file.reviewed)) {
    throw new ExamApiError('exam_media_binding_changed', 409)
  }
  if (grant.audience !== 'admin' && binding.files.some(sibling => sibling.file_id === file.file_id && sibling.slot.audience !== grant.audience)) {
    throw new ExamApiError('exam_media_scope_conflict', 403)
  }
  const account = await bindingAccount(db, binding, [file])
  const { response, mime } = await streamFile(file, account.accessToken, range, signal)
  const current = await getBaiduAccountContext()
  if (current.accountId !== account.accountId || current.generation !== account.generation) {
    await response.body?.cancel()
    throw new ExamApiError('baidu_account_changed', 409)
  }
  const headers = new Headers({
    'Cache-Control': 'private, no-store', 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
    Vary: 'Authorization, Cookie',
  })
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (response.status === 416) {
    await response.body?.cancel()
    headers.delete('content-length')
    return new Response(null, { status: 416, headers })
  }
  return new Response(response.body, { status: response.status, headers })
}
