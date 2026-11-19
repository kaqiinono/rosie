import 'server-only'
import { getBaiduAccountContext } from './baidu-token'
import { fetchBaiduFileById, listBaiduDirectory } from './baidu-media'
import { findProjectFile, projectPath, putProjectObject, removeProjectObject } from './baidu-project-transfer.mjs'

export async function fetchProjectMedia(bucket: string, path: string, range: string | null, signal: AbortSignal) {
  const target = projectPath(bucket, path)
  const directory = target.slice(0, target.lastIndexOf('/'))
  const account = await getBaiduAccountContext()
  const files = await listBaiduDirectory(directory, account)
  const cachedId = files.find(file => file.path === target)?.fs_id
  const download = (id: string) => fetchBaiduFileById(id, directory, range, signal,
    'material', account.accessToken, target, undefined, 'project')
  let response: Response | null = null
  if (cachedId) {
    response = await download(cachedId).catch(error => {
      if (!(error instanceof Error) || error.message !== 'baidu_api_error') throw error
      return null
    })
  }
  if (!response) {
    // A published directory can be cached while a file is added or replaced.
    const fresh = await findProjectFile(account.accessToken, target)
    if (!fresh || String(fresh.fs_id) === cachedId) return null
    response = await download(String(fresh.fs_id))
  }
  if (response?.status !== 416 && response?.headers.get('content-type')?.includes('application/json')) {
    await response.body?.cancel()
    throw Error('project_media_unavailable')
  }
  return response
}

export async function storeProjectMedia(bucket: string, path: string, bytes: Uint8Array) {
  const account = await getBaiduAccountContext()
  await putProjectObject(account.accessToken, projectPath(bucket, path), bytes)
}

export async function deleteProjectMedia(bucket: string, path: string) {
  const account = await getBaiduAccountContext()
  await removeProjectObject(account.accessToken, projectPath(bucket, path))
}
