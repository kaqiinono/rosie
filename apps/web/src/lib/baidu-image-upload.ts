import 'server-only'
import { createHash } from 'node:crypto'
import { exactBaiduId, parseBaiduJson } from './baidu-identity'
import { readBaiduDirectoryPage } from './baidu-directory-page'
import { fetchBaiduFileById, readBaiduFileMetadata } from './baidu-media'

// Baidu Open Platform: precreate → superfile2 → create. Never overwrite or auto-rename.
async function post(token: string, method: string, values: Record<string, string>) {
  const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
  url.search = new URLSearchParams({ method, access_token: token }).toString()
  const response = await fetch(url, { method: 'POST', body: new URLSearchParams(values), cache: 'no-store',
    redirect: 'error', signal: AbortSignal.timeout(20_000) })
  const body = parseBaiduJson(await response.text())
  if ([-6, 110, 111].includes(Number(body.errno ?? body.error_code))) throw new Error('baidu_reauthorize')
  if (!response.ok || body.errno !== 0) throw new Error('exam_image_upload_failed')
  return body
}

export async function findBaiduImageFile(token: string, directory: string, path: string) {
  for (let offset = 0; offset < 10_000; offset += 1000) {
    const rows = await readBaiduDirectoryPage(token, directory, offset, 1000)
    const found = rows.find(row => row.path === path)
    if (found) return found
    if (rows.length < 1000) return null
  }
  throw new Error('exam_image_directory_too_large')
}

export async function ensureBaiduImageDirectory(token: string, path: string) {
  const missing: string[] = []
  let current = path
  while (true) {
    try { await readBaiduDirectoryPage(token, current, 0, 1); break }
    catch (error) {
      if (!(error instanceof Error) || error.message !== 'baidu_directory_missing' || current === '/') throw error
      missing.push(current)
      current = current.slice(0, current.lastIndexOf('/')) || '/'
    }
  }
  for (const directory of missing.reverse()) {
    try { await post(token, 'create', { path: directory, size: '0', isdir: '1', rtype: '0' }) }
    catch {
      // A concurrent creator is acceptable only if the exact directory is now readable.
      await readBaiduDirectoryPage(token, directory, 0, 1)
    }
  }
}

export async function uploadBaiduExamImage(token: string, path: string, bytes: Uint8Array) {
  const directory = path.slice(0, path.lastIndexOf('/')) || '/'
  const md5 = createHash('md5').update(bytes).digest('hex')
  const recover = async () => {
    const existing = await findBaiduImageFile(token, directory, path)
    if (!existing) return null
    if (existing.isdir !== 0 || Number(existing.size) !== bytes.byteLength) throw new Error('exam_image_file_conflict')
    const id = exactBaiduId(existing.fs_id)
    const response = await fetchBaiduFileById(id, directory, null, AbortSignal.timeout(20_000), 'material', token, path)
    if (!response) throw new Error('exam_image_upload_failed')
    const downloaded = new Uint8Array(await response.arrayBuffer())
    if (downloaded.byteLength !== bytes.byteLength || createHash('md5').update(downloaded).digest('hex') !== md5) throw new Error('exam_image_file_conflict')
    const metadata = await readBaiduFileMetadata(id, token)
    if (!metadata || metadata.path !== path) throw new Error('exam_image_upload_failed')
    return metadata
  }
  const previous = await recover()
  if (previous) return previous
  const blockList = JSON.stringify([md5])
  try {
    const pre = await post(token, 'precreate', { path, size: String(bytes.byteLength), isdir: '0', autoinit: '1', rtype: '0', block_list: blockList })
    if (pre.return_type === 2) {
      const recovered = await recover()
      if (recovered) return recovered
      throw new Error('exam_image_upload_failed')
    }
    if (typeof pre.uploadid !== 'string' || !pre.uploadid || !Array.isArray(pre.block_list)
      || pre.block_list.some((index: unknown) => index !== 0)) throw new Error('exam_image_upload_failed')
    if (pre.block_list.includes(0)) {
      const url = new URL('https://d.pcs.baidu.com/rest/2.0/pcs/superfile2')
      url.search = new URLSearchParams({ method: 'upload', access_token: token, type: 'tmpfile', path, uploadid: pre.uploadid, partseq: '0' }).toString()
      const form = new FormData()
      form.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'crop.png')
      const response = await fetch(url, { method: 'POST', body: form, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000) })
      const uploaded = parseBaiduJson(await response.text())
      if (!response.ok || (uploaded.errno !== undefined && uploaded.errno !== 0) || uploaded.md5 !== md5) throw new Error('exam_image_upload_failed')
    }
    const result = await post(token, 'create', { path, size: String(bytes.byteLength), isdir: '0', rtype: '0', uploadid: pre.uploadid, block_list: blockList })
    const file = await readBaiduFileMetadata(exactBaiduId(result.fs_id), token)
    if (!file || file.path !== path || file.size !== bytes.byteLength) throw new Error('exam_image_upload_failed')
    return file
  } catch (error) {
    // The final create can succeed even if its response is lost. Recover only identical bytes.
    const recovered = await recover()
    if (recovered) return recovered
    throw error
  }
}

/** Caller supplies an owned file after a database reference guard, never a browser path. */
export async function deleteBaiduExamImage(token: string, path: string) {
  const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
  url.search = new URLSearchParams({ method: 'filemanager', opera: 'delete', access_token: token }).toString()
  const response = await fetch(url, { method: 'POST', body: new URLSearchParams({ async: '0', filelist: JSON.stringify([path]) }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) })
  const result = parseBaiduJson(await response.text())
  if (!response.ok || result.errno !== 0 || (Array.isArray(result.info) && result.info.some((item: { errno?: number }) => item.errno !== 0))) {
    throw new Error('exam_image_cleanup_failed')
  }
}
