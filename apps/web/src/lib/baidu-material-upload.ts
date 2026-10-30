import 'server-only'
import type { MaterialAsset } from '@rosie/materials'
import { createHash, randomUUID } from 'node:crypto'
import { createAdminSupabase } from './api-auth'
import { getBaiduAccountContext } from './baidu-token'
import { exactBaiduId, parseBaiduJson } from './baidu-identity'
import { getMaterialFile, openProviderFile } from './baidu-material-delivery'
export const PART_SIZE = 4 * 1024 * 1024
const subjects = [
  'chinese',
  'english',
  'math',
  'art',
  'science',
  'sports',
  'dance',
  'piano',
  'swimming',
  'other',
]
export type UploadInput = {
  name: string
  size: number
  subject: string
  mime: string
  hashes: string[]
}
export type UploadSession = UploadInput & {
  id: string
  user_id: string
  account_id: string
  account_generation: string
  path: string
  upload_id: string | null
  state: string
  parts: Record<string, string>
  asset_id: string | null
  claimed?: boolean
}
type Context = Awaited<ReturnType<typeof getBaiduAccountContext>>
export function validateManifest(raw: unknown): UploadInput {
  const d = raw as UploadInput,
    max = Number(process.env.BAIDU_MATERIAL_MAX_BYTES ?? 2147483648)
  if (!Number.isSafeInteger(max) || max < 1 || max > 2147483648)
    throw Error('upload_limit_configuration')
  if (
    !d ||
    !subjects.includes(d.subject) ||
    typeof d.name !== 'string' ||
    !d.name.trim() ||
    d.name.length > 240 ||
    /[\x00-\x1f]/.test(d.name) ||
    !Number.isSafeInteger(d.size) ||
    d.size < 1 ||
    d.size > max ||
    !Array.isArray(d.hashes) ||
    d.hashes.length !== Math.ceil(d.size / PART_SIZE) ||
    d.hashes.some((h) => typeof h !== 'string' || !/^[a-f0-9]{32}$/.test(h))
  )
    throw Error('invalid_upload_manifest')
  return {
    name: d.name,
    size: d.size,
    subject: d.subject,
    mime:
      typeof d.mime === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(d.mime)
        ? d.mime
        : 'application/octet-stream',
    hashes: d.hashes,
  }
}
export async function readPart(body: ReadableStream<Uint8Array>, size: number, hash: string) {
  const reader = body.getReader(),
    chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const r = await reader.read()
      if (r.done) break
      length += r.value.byteLength
      if (length > size || length > PART_SIZE) throw Error('part_size')
      chunks.push(r.value)
    }
    if (length !== size) throw Error('part_size')
    const data = Buffer.concat(chunks)
    if (createHash('md5').update(data).digest('hex') !== hash) throw Error('part_hash')
    return data
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
export function uploadForm(
  s: { path: string; size: number; hashes: string[]; upload_id?: string | null },
  method: 'precreate' | 'create',
) {
  const f = new URLSearchParams({
    path: s.path,
    size: String(s.size),
    isdir: '0',
    rtype: '0',
    block_list: JSON.stringify(s.hashes),
  })
  if (method === 'precreate') f.set('autoinit', '1')
  else f.set('uploadid', s.upload_id ?? '')
  return f
}
export function validateFinalFile(f: Record<string, unknown>, s: { path: string; size: number }) {
  if (f.path !== s.path || f.size !== s.size || f.isdir !== 0) throw Error('upload_verification')
  return exactBaiduId(f.fs_id)
}
async function provider(
  method: string,
  c: Context,
  body: URLSearchParams | FormData,
  query: Record<string, string> = {},
) {
  const u = new URL(
    method === 'upload'
      ? 'https://d.pcs.baidu.com/rest/2.0/pcs/superfile2'
      : 'https://pan.baidu.com/rest/2.0/xpan/file',
  )
  u.search = new URLSearchParams({ method, access_token: c.accessToken, ...query }).toString()
  const r = await fetch(u, {
    method: 'POST',
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(90000),
  })
  if (!r.ok) throw Error('baidu_upload_permission_or_service')
  const d = parseBaiduJson(await r.text()) as Record<string, unknown>
  if (d.errno !== undefined && d.errno !== 0) throw Error('baidu_upload_permission_or_service')
  return d
}
async function transition(
  id: string,
  user: string,
  c: Context,
  action: string,
  data: unknown = {},
) {
  const { data: result, error } = await createAdminSupabase().rpc('material_upload_transition', {
    p_id: id,
    p_user: user,
    p_account: c.accountId,
    p_generation: c.generation,
    p_action: action,
    p_data: data,
  })
  if (error) throw Error('upload_session_stale_or_unavailable')
  return result as UploadSession
}
export async function loadUpload(id: string, user: string, c: Context) {
  const { data, error } = await createAdminSupabase()
    .from('material_upload_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user)
    .maybeSingle()
  if (error || !data) throw Error('upload_session_not_found')
  const s = data as UploadSession
  if (s.account_id !== c.accountId || s.account_generation !== c.generation)
    throw Error('baidu_account_changed')
  return s
}
export function publicUpload(s: UploadSession) {
  return {
    id: s.id,
    name: s.name,
    size: s.size,
    subject: s.subject,
    mime: s.mime,
    hashes: s.hashes,
    state: s.state,
    asset_id: s.asset_id,
    partSize: PART_SIZE,
    missingParts: s.hashes.flatMap((h, i) => (s.parts[i] === h ? [] : [i])),
  }
}
export async function initUpload(raw: unknown, user: string) {
  const d = validateManifest(raw),
    root = process.env.BAIDU_MATERIAL_UPLOAD_ROOT
  if (
    !root ||
    !root.startsWith('/') ||
    root === '/' ||
    /[\\%\x00-\x1f]/.test(root) ||
    root.split('/').some((p) => p === '.' || p === '..')
  )
    throw Error('configure_BAIDU_MATERIAL_UPLOAD_ROOT_and_verify_app_write_permission')
  const c = await getBaiduAccountContext(),
    id = randomUUID(),
    path = root.replace(/\/$/, '') + '/' + id + '-' + d.name.replace(/[^\p{L}\p{N}._-]/gu, '_')
  return publicUpload(await transition(id, user, c, 'new', { ...d, path }))
}
export async function prepareUpload(id: string, user: string) {
  const c = await getBaiduAccountContext()
  let s = await transition(id, user, c, 'prepareclaim')
  if (!s.claimed) return publicUpload(s)
  try {
    const p = await provider('precreate', c, uploadForm(s, 'precreate'))
    const rapid = p.return_type === 2
    let missing = p.block_list
    if (rapid) missing = []
    if (
      !Array.isArray(missing) ||
      missing.some((i) => !Number.isInteger(i) || Number(i) < 0 || Number(i) >= s.hashes.length) ||
      new Set(missing).size !== missing.length ||
      (!rapid && typeof p.uploadid !== 'string')
    )
      throw Error('baidu_invalid_precreate')
    const parts: Record<string, string> = {}
    s.hashes.forEach((h, i) => {
      if (!(missing as number[]).includes(i)) parts[i] = h
    })
    s = await transition(id, user, c, 'prepared', { upload_id: p.uploadid ?? null, rapid, parts })
    return publicUpload(s)
  } catch {
    return { ...publicUpload(s), error: 'precreate_unconfirmed_recover_or_cancel_session' }
  }
}
export async function uploadPart(
  id: string,
  user: string,
  index: number,
  body: ReadableStream<Uint8Array>,
) {
  const c = await getBaiduAccountContext(),
    s = await loadUpload(id, user, c)
  if (s.state !== 'uploading' || !Number.isInteger(index) || index < 0 || index >= s.hashes.length)
    throw Error('invalid_upload_part')
  const bytes = await readPart(
    body,
    Math.min(PART_SIZE, s.size - index * PART_SIZE),
    s.hashes[index],
  )
  if (s.parts[index] === s.hashes[index]) return publicUpload(s)
  const f = new FormData()
  f.set('file', new Blob([new Uint8Array(bytes)]), 'part')
  const p = await provider('upload', c, f, {
    type: 'tmpfile',
    path: s.path,
    uploadid: s.upload_id!,
    partseq: String(index),
  })
  if (p.md5 !== s.hashes[index]) throw Error('baidu_part_hash')
  return publicUpload(await transition(id, user, c, 'part', { index, hash: p.md5 }))
}
async function verifyBytes(s: UploadSession, c: Context, fsid: string) {
  const response = await openProviderFile(c, fsid, s.size, null)
  const reader = response.body!.getReader()
  let index = 0,
    length = 0,
    total = 0,
    h = createHash('md5')
  try {
    while (true) {
      const r = await reader.read()
      if (r.done) break
      let offset = 0
      while (offset < r.value.length) {
        const count = Math.min(PART_SIZE - length, r.value.length - offset)
        h.update(r.value.subarray(offset, offset + count))
        offset += count
        length += count
        total += count
        if (total > s.size) throw Error('upload_integrity')
        if (length === PART_SIZE) {
          if (h.digest('hex') !== s.hashes[index++]) throw Error('upload_integrity')
          h = createHash('md5')
          length = 0
        }
      }
    }
    if (length && h.digest('hex') !== s.hashes[index++]) throw Error('upload_integrity')
    if (total !== s.size || index !== s.hashes.length) throw Error('upload_integrity')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
async function readyUpload(s: UploadSession) {
  const { data, error } = await createAdminSupabase()
    .from('material_assets')
    .select('*')
    .eq('id', s.asset_id)
    .maybeSingle()
  if (error || !data) throw Error('upload_asset_unavailable')
  return { ...publicUpload(s), asset: data as MaterialAsset }
}
export async function completeUpload(id: string, user: string) {
  const c = await getBaiduAccountContext()
  let s = await loadUpload(id, user, c)
  if (s.state === 'ready') return readyUpload(s)
  if (s.state === 'cancelled') throw Error('upload_cancelled')
  if (s.state === 'initializing')
    return { ...publicUpload(s), error: 'precreate_unconfirmed_cancel_and_start_again' }
  s = await transition(id, user, c, 'claim')
  try {
    let fsid: string | null = null
    if (s.claimed) {
      const p = await provider('create', c, uploadForm(s, 'create'))
      fsid = validateFinalFile(p, s)
    }
    // Unknown outcomes never issue create again; only verify stable path and full bytes.
    const file = await getMaterialFile(c, s.path)
    const verified = validateFinalFile(file, s)
    if (fsid && verified !== fsid) throw Error('upload_identity_conflict')
    if (!s.claimed) await verifyBytes(s, c, verified)
    s = await transition(id, user, c, 'publish', { path: s.path, size: s.size, fs_id: verified })
    return readyUpload(s)
  } catch {
    return { ...publicUpload(s), error: 'finalization_unconfirmed_retry_verification_only' }
  }
}
export async function queryUpload(id: string, user: string, cancel = false) {
  const c = await getBaiduAccountContext()
  return publicUpload(
    cancel ? await transition(id, user, c, 'cancel') : await loadUpload(id, user, c),
  )
}
