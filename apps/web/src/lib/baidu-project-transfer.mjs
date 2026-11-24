import { createHash } from 'node:crypto'

export const PROJECT_ROOT = '/airosie/project'
export const PART_BYTES = 4 * 1024 * 1024
export const RECORDING_BUCKETS = ['chinese-reading-recordings', 'english-story-recordings', 'exam-recordings']
export const PROJECT_BUCKETS = ['math', 'grammar-pages', 'word-images', 'exam-image-sources', 'reading', ...RECORDING_BUCKETS]

const dragonMastersPictures = '/airosie/english/story/dragon-masters/pics'
const privateRoots = [
  ...['exam-image-sources', 'chinese-reading-recordings', 'record', 'reading/stories'].map(folder => `${PROJECT_ROOT}/${folder}`),
  dragonMastersPictures,
]

/** @param {string} path */
export function isPrivateProjectPath(path) {
  const normalized = path.toLowerCase()
  return privateRoots.some(root => normalized === root || normalized.startsWith(root + '/'))
}

/** @param {string} series @param {string} name */
export function isStoryIllustrationName(series, name) {
  return /^ch\d{2,}-p\d{2,}(?:-[a-z])?\.webp$/.test(name) ||
    (series === 'dragon-masters' && /^ch\d{2,}-p\d{2,}-review-\d+-[a-f0-9]{10}\.webp$/.test(name))
}

/** @param {string} bucket @param {string} path */
export function projectPath(bucket, path) {
  const parts = path.split('/')
  if (!PROJECT_BUCKETS.includes(bucket) || path.length > 900 ||
    parts.some(part => !part || part === '.' || part === '..' || /[\\\u0000-\u001f\u007f]/.test(part))) {
    throw Error('invalid_project_media_path')
  }
  const [folder, series, volume, name] = parts
  if (bucket === 'reading' && folder === 'stories' && series === 'dragon-masters' && volume && /^[a-z0-9-]+$/.test(volume)) {
    if (parts.length === 3) return `${dragonMastersPictures}/${volume}`
    if (parts.length === 4 && isStoryIllustrationName(series, name)) return `${dragonMastersPictures}/${volume}/${name}`
  }
  const target = bucket === 'chinese-reading-recordings'
    ? parts.map(part => {
        // Storage allows colons in the legacy lesson keys. Baidu rejects those directory names.
        const prefix = 'rosie-path-'
        return /[:?*"<>|]/.test(part) || part.startsWith(prefix) || part !== part.trim() || part.endsWith('.')
          ? prefix + Buffer.from(part).toString('base64url')
          : part
      }).join('/')
    : path
  const root = RECORDING_BUCKETS.includes(bucket) ? `${PROJECT_ROOT}/record` : PROJECT_ROOT
  return `${root}/${bucket}/${target}`
}

/** @param {Uint8Array} bytes */
export function partHash(bytes) {
  return createHash('md5').update(bytes).digest('hex')
}

/** @param {string} raw */
export function parseProviderJson(raw) {
  return JSON.parse(raw.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, value =>
    /^-?\d+$/.test(value) && !Number.isSafeInteger(Number(value)) ? JSON.stringify(value) : value))
}

/** @param {string} token @param {string} endpoint @param {Record<string,string>} params @param {URLSearchParams | FormData} [body] */
async function request(token, endpoint, params, body) {
  const url = new URL(endpoint)
  url.search = new URLSearchParams({ ...params, access_token: token }).toString()
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', body, redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  const result = parseProviderJson(await response.text())
  if (!response.ok || (result.errno ?? 0) !== 0 || Number(result.error_code)) {
    const error = Error(`baidu_project_${params.method}_${Number(result.errno || result.error_code || response.status)}`)
    throw Object.assign(error, { errno: Number(result.errno) })
  }
  return result
}

const fileApi = 'https://pan.baidu.com/rest/2.0/xpan/file'

/** @param {string} token @param {string} directory */
export async function ensureProjectDirectory(token, directory) {
  const missing = []
  for (let current = directory; current; current = current.slice(0, current.lastIndexOf('/'))) {
    try {
      await request(token, fileApi, { method: 'list', dir: current, limit: '1' })
      break
    } catch (error) {
      if (/** @type {{ errno?: number }} */ (error).errno !== -9) throw error
      missing.push(current)
    }
  }
  for (const path of missing.reverse()) {
    try {
      await request(token, fileApi, { method: 'create' }, new URLSearchParams({ path, size: '0', isdir: '1', rtype: '0' }))
    } catch {
      await request(token, fileApi, { method: 'list', dir: path, limit: '1' })
    }
  }
}

/** @param {string} token @param {string} dir @param {number} start */
export async function listProjectDirectoryPage(token, dir, start) {
  try {
    const { list } = await request(token, fileApi, { method: 'list', dir, start: String(start), limit: '1000', order: 'name' })
    if (!Array.isArray(list) || list.length > 1000) throw Error('baidu_project_invalid_list')
    return list
  } catch (error) {
    if (/** @type {{ errno?: number }} */ (error).errno === -9) return []
    throw error
  }
}

/** @param {string} token @param {string} path */
export async function findProjectFile(token, path) {
  const directory = path.slice(0, path.lastIndexOf('/')) || '/'
  for (let start = 0; start < 100_000; start += 1000) {
    const list = await listProjectDirectoryPage(token, directory, start)
    const entry = list.find(item => item.path === path && item.isdir === 0)
    if (entry) return entry
    if (list.length < 1000) return null
  }
  throw Error('baidu_project_directory_too_large')
}

/** @param {string} path @param {number} size @param {string[]} hashes @param {boolean} overwrite */
function uploadParams(path, size, hashes, overwrite) {
  return new URLSearchParams({ path, size: String(size), isdir: '0', rtype: overwrite ? '3' : '0', block_list: JSON.stringify(hashes) })
}

/** @param {string} token @param {string} path @param {number} size @param {string[]} hashes @param {boolean} overwrite */
export async function startProjectUpload(token, path, size, hashes, overwrite) {
  await ensureProjectDirectory(token, path.slice(0, path.lastIndexOf('/')))
  const body = uploadParams(path, size, hashes, overwrite)
  body.set('autoinit', '1')
  const result = await request(token, fileApi, { method: 'precreate' }, body)
  if (result.return_type === 2) return null
  if (typeof result.uploadid !== 'string' || !Array.isArray(result.block_list) ||
    !result.block_list.every(part => Number.isInteger(part) && part >= 0 && part < hashes.length)) {
    throw Error('baidu_project_invalid_upload')
  }
  return { uploadId: /** @type {string} */ (result.uploadid), missing: /** @type {number[]} */ (result.block_list) }
}

/** @param {string} token @param {string} path @param {string} uploadId @param {number} index @param {Uint8Array} bytes @param {string} hash */
export async function uploadProjectPart(token, path, uploadId, index, bytes, hash) {
  if (partHash(bytes) !== hash) throw Error('baidu_project_part_changed')
  const form = new FormData()
  form.set('file', new Blob([new Uint8Array(bytes)]), 'part')
  const result = await request(token, 'https://d.pcs.baidu.com/rest/2.0/pcs/superfile2',
    { method: 'upload', type: 'tmpfile', path, uploadid: uploadId, partseq: String(index) }, form)
  if (result.md5 !== hash) throw Error('baidu_project_part_changed')
}

/** @param {string} token @param {string} path @param {number} size @param {string[]} hashes @param {boolean} overwrite @param {string} uploadId */
export async function finishProjectUpload(token, path, size, hashes, overwrite, uploadId) {
  const body = uploadParams(path, size, hashes, overwrite)
  body.set('uploadid', uploadId)
  const result = await request(token, fileApi, { method: 'create' }, body)
  if (result.path !== path || Number(result.size) !== size) throw Error('baidu_project_upload_mismatch')
  const id = String(result.fs_id)
  if (!/^[1-9]\d{0,19}$/.test(id)) throw Error('baidu_project_invalid_id')
  return id
}

/** @param {string} token @param {string} path @param {AbortSignal} [signal] @param {string} [knownId] */
export async function downloadProjectObject(token, path, signal, knownId) {
  const id = knownId ?? String((await findProjectFile(token, path))?.fs_id ?? '')
  if (!id) return null
  if (!/^[1-9]\d{0,19}$/.test(id)) throw Error('baidu_project_invalid_id')
  const { list } = await request(token, 'https://pan.baidu.com/rest/2.0/xpan/multimedia',
    { method: 'filemetas', fsids: `[${id}]`, dlink: '1' })
  const item = list?.[0]
  if (!item || item.path !== path || String(item.fs_id) !== id || typeof item.dlink !== 'string') throw Error('baidu_project_path_changed')
  let url = new URL(item.dlink)
  for (let index = 0; index < 5; index++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !/(^|\.)(baidu\.com|baidupcs\.com)$/.test(url.hostname)) throw Error('baidu_project_download_host')
    url.searchParams.set('access_token', token)
    const response = await fetch(url, {
      cache: 'no-store', redirect: 'manual', signal: signal ?? AbortSignal.timeout(120_000),
      headers: { 'User-Agent': 'pan.baidu.com', 'Accept-Encoding': 'identity' },
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      url = new URL(location, url)
      continue
    }
    if (response.ok && !response.headers.get('content-type')?.includes('application/json')) return response
    await response.body?.cancel()
    throw Error(`baidu_project_download_${response.status}`)
  }
  throw Error('baidu_project_download_redirects')
}

/** @param {Uint8Array} bytes */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** @param {string} token @param {string} path @param {Uint8Array} bytes @param {{ overwrite?: boolean, verify?: boolean }} [options] */
export async function putProjectObject(token, path, bytes, { overwrite = false, verify = false } = {}) {
  if (!bytes.length) throw Error('baidu_project_empty_file')
  if (!overwrite && verify) {
    const existing = await downloadProjectObject(token, path)
    if (existing) {
      if (sha256(new Uint8Array(await existing.arrayBuffer())) === sha256(bytes)) return
      throw Error('baidu_project_path_conflict')
    }
  }
  const parts = []
  for (let offset = 0; offset < bytes.length; offset += PART_BYTES) parts.push(bytes.subarray(offset, offset + PART_BYTES))
  const hashes = parts.map(partHash)
  const plan = await startProjectUpload(token, path, bytes.length, hashes, overwrite)
  let id
  if (plan) {
    for (const index of plan.missing) await uploadProjectPart(token, path, plan.uploadId, index, parts[index], hashes[index])
    id = await finishProjectUpload(token, path, bytes.length, hashes, overwrite, plan.uploadId)
  }
  if (verify || !plan) {
    const stored = await downloadProjectObject(token, path, undefined, id)
    if (!stored || sha256(new Uint8Array(await stored.arrayBuffer())) !== sha256(bytes)) {
      throw Error('baidu_project_checksum_mismatch')
    }
  }
}

/** @param {string} token @param {string} path */
export async function removeProjectObject(token, path) {
  if (!await findProjectFile(token, path)) return
  const result = await request(token, fileApi, { method: 'filemanager', opera: 'delete' },
    new URLSearchParams({ async: '0', filelist: JSON.stringify([path]) }))
  if (!Array.isArray(result.info) || result.info.some(item => item.errno !== 0)) throw Error('baidu_project_delete_failed')
}
