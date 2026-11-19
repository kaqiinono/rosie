import { supabase } from './supabase'
import { projectMediaUrl } from './projectMediaUrl'

export const PROJECT_PART_BYTES = 4 * 1024 * 1024

async function requestProjectMedia(url: string, accessToken: string, method: string, body?: BodyInit, ticket?: string) {
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` })
  if (ticket) headers.set('X-Project-Upload', ticket)
  if (typeof body === 'string') headers.set('Content-Type', 'application/json')
  const response = await fetch(url, { method, headers, body, cache: 'no-store' })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error ?? '文件操作失败')
  return result
}

async function projectMediaAccessToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('请先登录')
  return data.session.access_token
}

export async function uploadProjectMedia(bucket: string, path: string, file: Blob) {
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB')
    const token = await projectMediaAccessToken()
    const url = projectMediaUrl(bucket, path)
    if (file.size <= PROJECT_PART_BYTES) {
      await requestProjectMedia(url, token, 'PUT', file)
    } else {
      const parts = Array.from({ length: Math.ceil(file.size / PROJECT_PART_BYTES) }, (_, index) =>
        file.slice(index * PROJECT_PART_BYTES, (index + 1) * PROJECT_PART_BYTES))
      const hashes: string[] = []
      for (const part of parts) {
        const { hash } = await requestProjectMedia(`${url}?operation=hash`, token, 'PUT', part)
        hashes.push(hash)
      }
      const plan = await requestProjectMedia(`${url}?operation=start`, token, 'POST',
        JSON.stringify({ size: file.size, hashes })) as { complete: true } | { ticket: string; missing: number[] }
      if ('ticket' in plan) {
        for (const index of plan.missing) {
          await requestProjectMedia(`${url}?operation=part&index=${index}`, token, 'PUT', parts[index], plan.ticket)
        }
        await requestProjectMedia(`${url}?operation=finish`, token, 'POST', undefined, plan.ticket)
      }
    }
    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('上传失败') }
  }
}

export async function removeProjectMedia(bucket: string, path: string) {
  try {
    await requestProjectMedia(projectMediaUrl(bucket, path), await projectMediaAccessToken(), 'DELETE')
    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('删除失败') }
  }
}

export async function signProjectMedia(bucket: string, path: string): Promise<string | null> {
  try {
    const result = await requestProjectMedia(`${projectMediaUrl(bucket, path)}?operation=sign`,
      await projectMediaAccessToken(), 'POST')
    return typeof result?.url === 'string' ? result.url : null
  } catch {
    return null
  }
}
