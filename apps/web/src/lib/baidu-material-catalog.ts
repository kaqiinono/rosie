import 'server-only'
import { materialFileType } from './material-file-type'
import { materialScanPage } from './baidu-material-page'
import { createAdminSupabase } from './api-auth'
import { getBaiduAccountContext } from './baidu-token'
import { exactBaiduId, parseBaiduJson } from './baidu-identity'
export const materialRoots = {
  english: '/airosie/english',
  chinese: '/airosie/chinese',
  math: '/airosie/math',
} as const
export function normalizeMaterialPath(rootId: string, relativePath: string): string {
  if (
    !Object.hasOwn(materialRoots, rootId) ||
    typeof relativePath !== 'string' ||
    relativePath.length > 1500
  )
    throw Error('invalid_material_root')
  let decoded: string
  try {
    decoded = decodeURIComponent(relativePath)
  } catch {
    throw Error('invalid_material_path')
  }
  if (
    decoded.startsWith('/') ||
    /[\\\x00-\x1f%]/.test(decoded) ||
    /%2f|%5c/i.test(relativePath) ||
    decoded.split('/').some((s) => s === '.' || s === '..')
  )
    throw Error('invalid_material_path')
  return (
    materialRoots[rootId as keyof typeof materialRoots] +
    (decoded ? '/' + decoded.split('/').filter(Boolean).join('/') : '')
  )
}
export type MaterialFile = {
  account_id: string
  fs_id: string
  path: string
  name: string
  mime: string
  size: number
  isdir: boolean
  asset_id?: string
}
export type ScanState = {
  queue: { path: string; offset: number }[]
  entries: MaterialFile[]
  complete: boolean
}
export type ScanRequest = {
  rootId: string
  relativePath: string
  recursive: boolean
  sessionId?: string
  cursor?: string
  subject: string
}
export type ScanPage = {
  sessionId: string
  files: MaterialFile[]
  folders: MaterialFile[]
  cursor: string | null
  complete: boolean
  revision: number
  resultOffset: number
  nextResultOffset: number | null
  fileCount: number
  folderCount: number
}
type ProviderEntry = {
  fs_id: unknown
  path: unknown
  isdir: unknown
  size?: unknown
  server_filename?: unknown
}
export async function advanceScan(
  state: ScanState,
  account: string,
  recursive: boolean,
  list: (path: string, offset: number) => Promise<ProviderEntry[]>,
  limit = 200,
): Promise<ScanState> {
  const next: ScanState = structuredClone(state)
  const dir = next.queue[0]
  if (!dir) return { ...next, complete: true }
  const rows = await list(dir.path, dir.offset)
  if (rows.length > limit) throw Error('baidu_invalid_page')
  for (const row of rows) {
    if (
      typeof row.path !== 'string' ||
      row.path.length > 4096 ||
      /[\\\x00-\x1f]/.test(row.path) ||
      ['.', '..', ''].includes(row.path.split('/').at(-1)!) ||
      row.path.slice(0, row.path.lastIndexOf('/')) !== dir.path ||
      !(row.isdir === 0 || row.isdir === 1)
    )
      throw Error('baidu_invalid_path')
    if (
      row.isdir === 0 &&
      (typeof row.size !== 'number' || !Number.isSafeInteger(row.size) || row.size < 0)
    )
      throw Error('baidu_invalid_size')
    const fs_id = exactBaiduId(row.fs_id),
      isdir = row.isdir === 1
    const existing = next.entries.findIndex((f) => f.fs_id === fs_id)
    const file = {
      account_id: account,
      fs_id,
      path: row.path,
      name: row.path.split('/').at(-1)!,
      mime: materialFileType(row.path).mime,
      size:
        typeof row.size === 'number' && Number.isSafeInteger(row.size) && row.size >= 0
          ? row.size
          : 0,
      isdir,
    }
    if (existing < 0) next.entries.push(file)
    else next.entries[existing] = file
    if (isdir && recursive && existing < 0) next.queue.push({ path: row.path, offset: 0 })
  }
  if (rows.length < limit) next.queue.shift()
  else dir.offset += rows.length
  if (next.entries.length > 20000 || next.queue.length > 2000 || dir.offset > 100000)
    throw Error('material_scan_limit')
  next.complete = next.queue.length === 0
  return next
}
export async function scanMaterialDirectory(input: ScanRequest, userId: string): Promise<ScanPage> {
  const path = normalizeMaterialPath(input.rootId, input.relativePath)
  if (
    typeof input.recursive !== 'boolean' ||
    ![
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
    ].includes(input.subject)
  )
    throw Error('invalid_scan')
  const account = await getBaiduAccountContext(),
    db = createAdminSupabase()
  let id = input.sessionId,
    revision = 0,
    state: ScanState = { queue: [{ path, offset: 0 }], entries: [], complete: false }
  if (id) {
    const { data, error } = await db
      .from('material_scan_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (error || !data) throw Error('scan_not_found')
    if (data.account_id !== account.accountId || data.account_generation !== account.generation)
      throw Error('baidu_account_changed')
    if (
      data.path !== path ||
      data.recursive !== input.recursive ||
      data.subject !== input.subject ||
      data.root_id !== input.rootId
    )
      throw Error('scan_request_changed')
    revision = data.revision
    state = data.state as ScanState
    if (input.cursor !== String(revision)) throw Error('scan_cursor_stale')
  } else {
    const { data, error } = await db
      .from('material_scan_sessions')
      .insert({
        user_id: userId,
        account_id: account.accountId,
        account_generation: account.generation,
        root_id: input.rootId,
        path,
        recursive: input.recursive,
        subject: input.subject,
        state,
      })
      .select('id')
      .single()
    if (error) throw Error('scan_storage_error')
    id = data.id
    return materialScanPage(id!, state, 0)
  }
  if (!state.complete)
    state = await advanceScan(state, account.accountId, input.recursive, async (dir, offset) => {
      const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
      url.search = new URLSearchParams({
        method: 'list',
        dir,
        start: String(offset),
        limit: '200',
        order: 'name',
        access_token: account.accessToken,
      }).toString()
      const response = await fetch(url, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      })
      const body = parseBaiduJson(await response.text())
      if (!response.ok || body.errno !== 0 || !Array.isArray(body.list))
        throw Error('baidu_list_failed')
      return body.list as ProviderEntry[]
    })
  const { error } = await db.rpc('material_publish_scan', {
    p_id: id,
    p_user: userId,
    p_revision: revision,
    p_account: account.accountId,
    p_generation: account.generation,
    p_state: state,
  })
  if (error) throw Error('scan_stale_or_account_changed')
  return materialScanPage(id!, state, revision + 1)
}
