import 'server-only'

import { isDeepStrictEqual } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamMediaEditor, ExamMediaSaveReceipt, ExamMediaSaveRequest } from '@rosie/exams'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { readBaiduDirectoryPage } from '@/lib/baidu-directory-page'
import { readBaiduFileMetadata } from '@/lib/baidu-media'
import { ExamApiError, examIdentifier } from './http'
import { examListeningParts } from './listeningMedia'
import { examMediaParts } from './mediaParts'
import { examMediaMime, readExamMediaBinding, readExamMediaDraft, validExamMediaPath, withinExamDirectory, type StoredExamMediaFile } from './media'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
function invalid(): never { throw new ExamApiError('exam_invalid_media_binding', 400) }

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
  if (status !== 'draft') throw new ExamApiError('exam_not_editable', 409)
  const bindingRevisionId = draft.content.mediaBindingRevisionId
  const binding = bindingRevisionId ? await readExamMediaBinding(db, revisionId, bindingRevisionId) : null
  const mainDirectory = binding ? { directory_id: binding.directory_id, path: binding.main_path, generation: binding.account_generation } : null
  return { revisionId, testNumber: draft.contentSet.testNumber, version, bindingRevisionId, mainDirectory, parts: examMediaParts(draft), slots: [...draft.content.mediaSlots, ...draft.solutions.mediaSlots].map(slot => {
    const file = binding?.files.find(item => item.slot_id === slot.id && isDeepStrictEqual(item.slot, slot))
    return { ...slot, binding: file ? { fileId: file.file_id, name: file.path.slice(file.path.lastIndexOf('/') + 1), size: file.size, reviewed: file.reviewed, durationMs: file.duration_ms } : null }
  }) }
}

export async function saveExamMediaBindings(db: SupabaseClient, actorId: string, command: ExamMediaSaveRequest, cropLease?: string): Promise<ExamMediaSaveReceipt> {
  const { draft } = await readExamMediaDraft(db, command.revisionId)
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
  const account = await getBaiduAccountContext()
  if (account.generation !== command.accountGeneration) throw new ExamApiError('baidu_account_changed', 409)
  const { data: root, error } = await db.from('baidu_sync_directories').select('path').eq('id', command.directoryId).eq('account_id', account.accountId).maybeSingle()
  if (error) throw new ExamApiError('exam_media_unavailable', 503)
  if (!root || typeof root.path !== 'string' || (command.mainPath !== root.path && !withinExamDirectory(command.mainPath, root.path))) invalid()
  await readBaiduDirectoryPage(account.accessToken, command.mainPath, 0, 1)
  // Read the caller's previous immutable version, not a newer competing edit.
  const previous = command.expectedBindingRevisionId ? await readExamMediaBinding(db, command.revisionId, command.expectedBindingRevisionId) : null
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
      md5: info.md5, modified_at: info.modifiedAt, reviewed: pick.reviewed, duration_ms: pick.durationMs ?? null })
  }
  for (const file of files.values()) {
    if (!withinExamDirectory(file.path, command.mainPath)) throw new ExamApiError('exam_invalid_media_binding', 409)
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
  const { data, error: saveError } = await db.rpc(cropLease ? 'finish_exam_image_crop' : 'save_exam_media_bindings', {
    p_id: command.revisionId, p_expected_version: command.expectedVersion, p_expected_binding: command.expectedBindingRevisionId,
    p_request_id: command.requestId, p_actor: actorId, p_account: account.accountId, p_generation: account.generation,
    p_directory_id: command.directoryId, p_main_path: command.mainPath,
    p_files: [...files.values()].sort((left, right) => left.slot_id < right.slot_id ? -1 : left.slot_id > right.slot_id ? 1 : 0),
    ...(cropLease ? { p_lease: cropLease } : {}),
  })
  if (saveError) {
    const allowed = ['exam_conflict', 'exam_not_editable', 'exam_not_found', 'exam_invalid_request', 'exam_invalid_media_binding', 'baidu_account_changed']
    throw new ExamApiError(allowed.includes(saveError.message) ? saveError.message : 'exam_media_unavailable', saveError.message === 'exam_not_found' ? 404 : allowed.includes(saveError.message) ? 409 : 503)
  }
  if (!record(data) || data.revisionId !== command.revisionId || !uuid(data.version) || !uuid(data.bindingRevisionId)) throw new ExamApiError('exam_media_unavailable', 503)
  return { revisionId: command.revisionId, version: data.version, bindingRevisionId: data.bindingRevisionId }
}
