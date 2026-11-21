import 'server-only'

import { isDeepStrictEqual } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamListeningDirectoryRequest, ExamMediaEditor, ExamMediaSaveReceipt, ExamMediaSaveRequest } from '@rosie/exams'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { readBaiduDirectoryPage } from '@/lib/baidu-directory-page'
import { readBaiduFileMetadata } from '@/lib/baidu-media'
import { ExamApiError, examIdentifier, readExamJsonBody } from './http'
import { examListeningParts } from './listeningMedia'
import { examMediaParts } from './mediaParts'
import { examMediaMime, readExamMediaBinding, readExamMediaDraft, serveExamMediaFile, streamExamMediaFile, validExamMediaPath, withinExamDirectory, type StoredExamMediaFile } from './media'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
function invalid(): never { throw new ExamApiError('exam_invalid_media_binding', 400) }

async function readAuthorizedDirectory(db: SupabaseClient, command: Pick<ExamListeningDirectoryRequest, 'accountGeneration' | 'directoryId' | 'mainPath'>) {
  const account = await getBaiduAccountContext()
  if (account.generation !== command.accountGeneration) throw new ExamApiError('baidu_account_changed', 409)
  const { data: root, error } = await db.from('baidu_sync_directories').select('path').eq('id', command.directoryId).eq('account_id', account.accountId).maybeSingle()
  if (error) throw new ExamApiError('exam_media_unavailable', 503)
  if (!root || typeof root.path !== 'string' || (command.mainPath !== root.path && !withinExamDirectory(command.mainPath, root.path))) invalid()
  await readBaiduDirectoryPage(account.accessToken, command.mainPath, 0, 1)
  return account
}

function mediaWriteError(message: string): never {
  const allowed = ['exam_conflict', 'exam_not_editable', 'exam_not_found', 'exam_invalid_request', 'exam_invalid_media_binding', 'baidu_account_changed']
  throw new ExamApiError(allowed.includes(message) ? message : 'exam_media_unavailable', message === 'exam_not_found' ? 404 : allowed.includes(message) ? 409 : 503)
}

export async function saveExamListeningDirectory(db: SupabaseClient, actorId: string, request: Request) {
  const body = await readExamJsonBody(request)
  const allowed = ['revisionId', 'expectedVersion', 'expectedDirectoryVersion', 'requestId', 'accountGeneration', 'directoryId', 'mainPath']
  if (!record(body) || Object.keys(body).some(key => !allowed.includes(key)) || !uuid(body.expectedVersion)
    || (body.expectedDirectoryVersion !== null && !uuid(body.expectedDirectoryVersion))
    || !uuid(body.requestId) || !uuid(body.accountGeneration) || !uuid(body.directoryId) || !validExamMediaPath(body.mainPath)) invalid()
  const command: ExamListeningDirectoryRequest = {
    revisionId: examIdentifier(body.revisionId), expectedVersion: body.expectedVersion, requestId: body.requestId,
    expectedDirectoryVersion: body.expectedDirectoryVersion,
    accountGeneration: body.accountGeneration, directoryId: body.directoryId, mainPath: body.mainPath,
  }
  const account = await readAuthorizedDirectory(db, command)
  const { data, error } = await db.rpc('save_exam_listening_directory', {
    p_id: command.revisionId, p_expected_version: command.expectedVersion, p_request_id: command.requestId, p_actor: actorId,
    p_expected_directory_version: command.expectedDirectoryVersion,
    p_account: account.accountId, p_generation: account.generation, p_directory_id: command.directoryId, p_path: command.mainPath,
  })
  if (error) mediaWriteError(error.message)
  if (!uuid(data)) throw new ExamApiError('exam_media_unavailable', 503)
  return { listeningDirectoryVersion: data, listeningDirectory: { directory_id: command.directoryId, path: command.mainPath, generation: account.generation } }
}

export async function readExamMediaSaveRequest(request: Request): Promise<ExamMediaSaveRequest> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ExamApiError('exam_json_required', 415)
  if (!request.body) invalid()
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  let bytes = 0
  let value: unknown
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 1024 * 1024) { await reader.cancel(); throw new ExamApiError('exam_payload_too_large', 413) }
      text += decoder.decode(next.value, { stream: true })
    }
    value = JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    if (error instanceof ExamApiError) throw error
    throw new ExamApiError('exam_invalid_json', 400)
  } finally { reader.releaseLock() }
  const allowed = ['revisionId', 'scope', 'expectedVersion', 'expectedBindingRevisionId', 'requestId', 'accountGeneration', 'directoryId', 'mainPath', 'picks', 'removeSlotIds', 'updates']
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))
    || !uuid(value.expectedVersion) || !uuid(value.requestId) || !uuid(value.accountGeneration) || !uuid(value.directoryId)
    || (value.expectedBindingRevisionId !== null && !uuid(value.expectedBindingRevisionId))
    || !validExamMediaPath(value.mainPath) || !Array.isArray(value.picks) || value.picks.length > 2000
    || (value.removeSlotIds !== undefined && (!Array.isArray(value.removeSlotIds) || value.removeSlotIds.length > 2000))
    || (value.updates !== undefined && (!Array.isArray(value.updates) || value.updates.length > 2000))) invalid()
  examIdentifier(value.revisionId)
  if (value.scope !== undefined && value.scope !== null && value.scope !== 'listening') {
    if (!record(value.scope) || Object.keys(value.scope).some(key => !['sectionId', 'partNumber'].includes(key))
      || typeof value.scope.sectionId !== 'string' || !value.scope.sectionId
      || typeof value.scope.partNumber !== 'number' || !Number.isSafeInteger(value.scope.partNumber) || value.scope.partNumber < 1) invalid()
  }
  const seen = new Set<string>()
  for (const pick of value.picks as unknown[]) {
    if (!record(pick) || Object.keys(pick).some(key => !['slotId', 'fileId', 'path', 'reviewed', 'durationMs'].includes(key))
      || typeof pick.slotId !== 'string' || seen.has(pick.slotId) || typeof pick.fileId !== 'string' || !/^[1-9]\d{0,19}$/.test(pick.fileId)
      || !validExamMediaPath(pick.path) || typeof pick.reviewed !== 'boolean'
      || (pick.durationMs !== undefined && pick.durationMs !== null && (typeof pick.durationMs !== 'number' || !Number.isSafeInteger(pick.durationMs) || pick.durationMs <= 0 || pick.durationMs > 86_400_000))) invalid()
    examIdentifier(pick.slotId)
    seen.add(pick.slotId)
  }
  for (const slotId of (value.removeSlotIds ?? []) as unknown[]) {
    const id = examIdentifier(slotId)
    if (seen.has(id)) invalid()
    seen.add(id)
  }
  for (const update of (value.updates ?? []) as unknown[]) {
    if (!record(update) || Object.keys(update).some(key => !['slotId', 'reviewed', 'durationMs'].includes(key))
      || typeof update.reviewed !== 'boolean'
      || (update.durationMs !== null && (typeof update.durationMs !== 'number' || !Number.isSafeInteger(update.durationMs) || update.durationMs <= 0 || update.durationMs > 86_400_000))) invalid()
    const id = examIdentifier(update.slotId)
    if (seen.has(id)) invalid()
    seen.add(id)
  }
  return value as unknown as ExamMediaSaveRequest
}

export async function readExamMediaEditor(db: SupabaseClient, revisionId: string): Promise<ExamMediaEditor> {
  const { draft, version, status } = await readExamMediaDraft(db, revisionId)
  if (status !== 'draft' && status !== 'published') throw new ExamApiError('exam_not_editable', 409)
  const bindingRevisionId = draft.content.mediaBindingRevisionId
  const [binding, directory] = await Promise.all([
    bindingRevisionId ? readExamMediaBinding(db, revisionId, bindingRevisionId) : null,
    db.from('exam_content_revisions').select('listening_directory').eq('id', revisionId).eq('version', version).maybeSingle(),
  ])
  if (directory.error) throw new ExamApiError('exam_media_unavailable', 503)
  if (!directory.data) throw new ExamApiError('exam_conflict', 409)
  const selected: unknown = directory.data.listening_directory
  let listeningDirectory: ExamMediaEditor['listeningDirectory'] = null
  let listeningDirectoryVersion: string | null = null
  if (selected !== null) {
    if (!record(selected) || !uuid(selected.directory_id) || !validExamMediaPath(selected.path) || !uuid(selected.generation) || !uuid(selected.request_id)) {
      throw new ExamApiError('exam_media_unavailable', 503)
    }
    listeningDirectory = { directory_id: selected.directory_id, path: selected.path, generation: selected.generation }
    listeningDirectoryVersion = selected.request_id
  } else if (binding?.files.some(file => file.slot.purpose === 'exam_listening' || file.slot.purpose === 'training_audio')) {
    listeningDirectory = { directory_id: binding.directory_id, path: binding.main_path, generation: binding.account_generation }
  }
  return { revisionId, status, testNumber: draft.contentSet.testNumber, version, bindingRevisionId, listeningDirectory, listeningDirectoryVersion, parts: examMediaParts(draft), slots: [...draft.content.mediaSlots, ...draft.solutions.mediaSlots].map(slot => {
    const file = binding?.files.find(item => item.slot_id === slot.id && isDeepStrictEqual(item.slot, slot))
    return { ...slot, binding: file ? { fileId: file.file_id, name: file.path.slice(file.path.lastIndexOf('/') + 1), size: file.size, reviewed: file.reviewed, durationMs: file.duration_ms } : null }
  }) }
}

export async function fetchExamListeningCandidate(
  db: SupabaseClient, revisionId: string, slotId: string, fileId: string, path: string,
  range: string | null, signal: AbortSignal,
) {
  if (!/^[1-9]\d{0,19}$/.test(fileId) || !validExamMediaPath(path)) invalid()
  const editor = await readExamMediaEditor(db, revisionId)
  const directory = editor.listeningDirectory
  const slot = examListeningParts(editor.parts, editor.slots).flatMap(part => part.slots).find(item => item.id === slotId)
  if (!directory || !slot || !withinExamDirectory(path, directory.path) || !examMediaMime(slot, path)) invalid()
  const account = await readAuthorizedDirectory(db, {
    accountGeneration: directory.generation, directoryId: directory.directory_id, mainPath: directory.path,
  })
  const info = await readBaiduFileMetadata(fileId, account.accessToken)
  if (!info || info.path !== path || info.size <= 0 || (info.md5 === null && info.modifiedAt === null)) {
    throw new ExamApiError('exam_media_file_missing', 409)
  }
  return serveExamMediaFile({
    slot_id: slot.id, slot, file_id: info.id, path: info.path, size: info.size, md5: info.md5,
    modified_at: info.modifiedAt, reviewed: false, duration_ms: null,
  }, account, range, signal)
}

export async function saveExamMediaBindings(db: SupabaseClient, actorId: string, command: ExamMediaSaveRequest, cropLease?: string): Promise<ExamMediaSaveReceipt> {
  const { draft, status } = await readExamMediaDraft(db, command.revisionId)
  const slots = new Map([...draft.content.mediaSlots, ...draft.solutions.mediaSlots].map(slot => [slot.id, slot]))
  if (command.scope !== undefined) {
    const parts = examMediaParts(draft)
    const scope = command.scope
    let allowed: Set<string>
    if (scope === 'listening') {
      allowed = new Set(examListeningParts(parts, draft.content.mediaSlots).flatMap(part => part.slots.map(slot => slot.id)))
    } else if (scope) {
      const part = parts.find(item => item.sectionId === scope.sectionId && item.partNumber === scope.partNumber)
      if (!part) invalid()
      allowed = new Set(part.slotIds)
    } else {
      const assigned = new Set(parts.flatMap(item => [...item.slotIds]))
      allowed = new Set([...slots.keys()].filter(id => !assigned.has(id)))
    }
    const changed = [...command.picks.map(item => item.slotId), ...(command.updates ?? []).map(item => item.slotId), ...(command.removeSlotIds ?? [])]
    if (changed.some(id => !allowed.has(id))) invalid()
  }
  const account = await readAuthorizedDirectory(db, command)
  // Read the caller's previous immutable version, not a newer competing edit.
  const previous = command.expectedBindingRevisionId ? await readExamMediaBinding(db, command.revisionId, command.expectedBindingRevisionId) : null
  const listening = command.scope === 'listening'
  const usePreviousRoot = listening && previous?.account_id === account.accountId && previous.account_generation === account.generation
  const directoryId = usePreviousRoot ? previous.directory_id : command.directoryId
  const mainPath = usePreviousRoot ? previous.main_path : command.mainPath
  const files = new Map<string, StoredExamMediaFile>()
  for (const file of previous?.files ?? []) {
    if (isDeepStrictEqual(file.slot, slots.get(file.slot_id))) files.set(file.slot_id, file)
  }
  for (const slotId of command.removeSlotIds ?? []) {
    if (!slots.has(slotId)) invalid()
    files.delete(slotId)
  }
  const replacements = new Set(command.picks.map(pick => pick.slotId))
  for (const file of files.values()) {
    if (!replacements.has(file.slot_id) && previous
      && (previous.account_id !== account.accountId || previous.account_generation !== account.generation)) throw new ExamApiError('baidu_account_changed', 409)
  }
  const metadata = new Map<string, Awaited<ReturnType<typeof readBaiduFileMetadata>>>()
  const inspect = async (id: string) => {
    if (!metadata.has(id)) metadata.set(id, await readBaiduFileMetadata(id, account.accessToken))
    const result = metadata.get(id)
    if (!result || result.size <= 0 || (result.md5 === null && result.modifiedAt === null)) throw new ExamApiError('exam_media_file_missing', 409)
    return result
  }
  // Independent metadata reads overlap in small batches; every retained file is still checked.
  // This avoids serially re-reading an entire paper for each newly prepared image.
  const fileIds = [...new Set([...command.picks.map(pick => pick.fileId), ...[...files.values()]
    .filter(file => !replacements.has(file.slot_id)).map(file => file.file_id)])]
  for (let offset = 0; offset < fileIds.length; offset += 4) {
    const results = await Promise.allSettled(fileIds.slice(offset, offset + 4).map(inspect))
    for (const result of results) if (result.status === 'rejected') throw result.reason
  }
  for (const pick of command.picks) {
    const slot = slots.get(pick.slotId)
    if (!slot || !withinExamDirectory(pick.path, command.mainPath) || !examMediaMime(slot, pick.path)) invalid()
    const info = await inspect(pick.fileId)
    if (info.path !== pick.path) throw new ExamApiError('exam_media_binding_changed', 409)
    files.set(slot.id, { slot_id: slot.id, slot, file_id: info.id, path: info.path, size: info.size,
      ...(listening ? { directory_id: command.directoryId } : {}),
      md5: info.md5, modified_at: info.modifiedAt, reviewed: pick.reviewed, duration_ms: pick.durationMs ?? null })
  }
  for (const file of files.values()) {
    if (!file.directory_id && !withinExamDirectory(file.path, mainPath)) throw new ExamApiError('exam_invalid_media_binding', 409)
    const info = await inspect(file.file_id)
    if (info.path !== file.path || info.size !== file.size || info.md5 !== file.md5 || info.modifiedAt !== file.modified_at) {
      throw new ExamApiError('exam_media_binding_changed', 409)
    }
  }
  for (const update of command.updates ?? []) {
    const file = files.get(update.slotId)
    if (!file) invalid()
    files.set(update.slotId, { ...file, reviewed: update.reviewed, duration_ms: update.durationMs })
  }
  if (listening) {
    const changed = new Set([...replacements, ...(command.updates ?? []).map(update => update.slotId)])
    const probes = new Map<string, () => Promise<void>>()
    if (status === 'published' && (command.removeSlotIds ?? []).some(id => slots.get(id)?.required && !files.has(id))) {
      throw new ExamApiError('exam_invalid_media_binding', 409)
    }
    for (const id of changed) {
      const file = files.get(id)
      const part = examMediaParts(draft).find(item => item.slotIds.includes(id))?.label ?? '听力'
      const issue = (message: string) => new ExamApiError('exam_invalid_media_binding', 409, [{
        path: `$.content.mediaSlots[${draft.content.mediaSlots.findIndex(slot => slot.id === id)}]`,
        code: 'exam_invalid_media_binding', message: `${part}：${message}`,
      }])
      if (!file?.reviewed || !file.duration_ms || (file.slot.segment && file.slot.segment.endMs > file.duration_ms)) {
        throw issue('无法获取有效音频时长，或试卷配置的片段超出文件时长。')
      }
      if ([...files.values()].some(other => other.file_id === file.file_id && other.slot.audience !== file.slot.audience)) {
        throw issue('该文件已用于不同访问权限的资源槽位。')
      }
      if (!probes.has(file.file_id)) {
        probes.set(file.file_id, async () => {
          try {
            const { response } = await streamExamMediaFile(file, account.accessToken, 'bytes=0-0', AbortSignal.timeout(15_000))
            await response.body?.cancel()
            if (response.status !== 200 && response.status !== 206) throw issue('音频文件无法读取。')
          } catch { throw issue('音频文件无法读取。') }
        })
      }
    }
    const checks = [...probes.values()]
    for (let offset = 0; offset < checks.length; offset += 4) {
      await Promise.all(checks.slice(offset, offset + 4).map(probe => probe()))
    }
  }
  const { data, error: saveError } = await db.rpc(cropLease ? 'finish_exam_image_crop' : 'save_exam_media_bindings', {
    p_id: command.revisionId, p_expected_version: command.expectedVersion, p_expected_binding: command.expectedBindingRevisionId,
    p_request_id: command.requestId, p_actor: actorId, p_account: account.accountId, p_generation: account.generation,
    p_directory_id: directoryId, p_main_path: mainPath,
    p_files: [...files.values()].sort((left, right) => left.slot_id < right.slot_id ? -1 : left.slot_id > right.slot_id ? 1 : 0),
    ...(cropLease ? { p_lease: cropLease } : {}),
  })
  if (saveError) mediaWriteError(saveError.message)
  if (!record(data) || typeof data.revisionId !== 'string' || !uuid(data.version) || !uuid(data.bindingRevisionId)) throw new ExamApiError('exam_media_unavailable', 503)
  return { revisionId: examIdentifier(data.revisionId), version: data.version, bindingRevisionId: data.bindingRevisionId }
}
