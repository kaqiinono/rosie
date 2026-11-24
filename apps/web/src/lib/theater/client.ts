import { supabase } from '@rosie/core'

async function getTheaterSession(signal?: AbortSignal | null) {
  if (!signal) return supabase.auth.getSession()
  const abortError = () => signal.reason ?? new Error('请求已取消。')
  if (signal.aborted) throw abortError()
  let onAbort: () => void = () => {}
  const canceled = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([supabase.auth.getSession(), canceled])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export async function requestTheater<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await getTheaterSession(init.signal)
  if (error || data.session?.user.id !== userId) throw Error('登录已过期，请重新登录。')
  const headers = new Headers(init.headers)
  headers.set('Authorization', 'Bearer ' + data.session.access_token)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
  if (response.status === 204) return undefined as T
  const result = await response.json().catch(() => null)
  if (!response.ok) throw Error(typeof result?.error === 'string' ? result.error : '请求失败，请重试。')
  if (result === null) throw Error('返回内容无效，请重试。')
  return result as T
}
