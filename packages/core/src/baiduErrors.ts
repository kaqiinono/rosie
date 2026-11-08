/** Public error codes only; never expose provider responses or credentials. */
export const BAIDU_AUTH_MESSAGES: Record<string, string> = {
  baidu_not_authorized: '共享百度网盘尚未授权，请联系管理员在「同步管理」完成授权。',
  baidu_reauthorize: '共享百度网盘授权已失效，请联系管理员在「同步管理」重新授权。',
  baidu_refresh_uncertain: '共享百度网盘自动续期未能确认，请联系管理员在「同步管理」重新授权。',
}

export function baiduAuthErrorCode(error: unknown): string | null {
  const code = error instanceof Error ? error.message : error
  return typeof code === 'string' && Object.hasOwn(BAIDU_AUTH_MESSAGES, code) ? code : null
}

export async function baiduResponseMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  const code = body && typeof body === 'object' && 'error' in body ? baiduAuthErrorCode(body.error) : null
  if (code) return BAIDU_AUTH_MESSAGES[code]
  if (response.status === 401) return 'Rosie 登录会话已失效，请重新登录后重试。'
  if (response.status === 404) return '找不到网盘资源，请联系管理员核对目录和文件。'
  return fallback
}

/** Native media elements hide HTTP errors; probe only after failure or before preview. */
export async function probeBaiduMedia(url: string, signal: AbortSignal): Promise<string | null> {
  const target = new URL(url, window.location.origin)
  if (target.origin !== window.location.origin || !/^\/api\/baidu\/(audio|video)\//.test(target.pathname)) return null
  const response = await fetch(target, {
    headers: { Range: 'bytes=0-0' }, cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  })
  if (!response.ok) return baiduResponseMessage(response, '网盘资源暂时无法读取，请稍后重试。')
  await response.body?.cancel()
  return null
}
