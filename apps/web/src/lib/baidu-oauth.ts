import 'server-only'

export const BAIDU_STATE_COOKIE = 'rosie_baidu_oauth_state'
export const BAIDU_STATE_TTL_SECONDS = 600
export const BAIDU_COOKIE_PATH = '/api/baidu/oauth'

export type BaiduOAuthConfig = {
  appKey: string
  secretKey: string
  redirectUri: string
}

export type BaiduOAuthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
}

export function getBaiduOAuthConfig(): BaiduOAuthConfig {
  const appKey = process.env.BAIDU_APP_KEY?.trim()
  const secretKey = process.env.BAIDU_SECRET_KEY?.trim()
  const redirectUri = process.env.BAIDU_REDIRECT_URI?.trim()
  if (!appKey || !secretKey || !redirectUri) throw new Error('missing_config')

  const callback = new URL(redirectUri)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname)
  if (
    (callback.protocol !== 'https:' && !(local && callback.protocol === 'http:')) ||
    callback.pathname !== '/api/baidu/oauth/callback' ||
    callback.search || callback.hash || callback.username || callback.password
  ) throw new Error('invalid_config')

  return { appKey, secretKey, redirectUri }
}

export function baiduAuthorizationUrl(config: BaiduOAuthConfig, state: string): string {
  const url = new URL('https://openapi.baidu.com/oauth/2.0/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.appKey,
    redirect_uri: config.redirectUri,
    scope: 'basic,netdisk',
    state,
  }).toString()
  return url.toString()
}

export async function exchangeBaiduCode(
  config: BaiduOAuthConfig,
  code: string,
): Promise<BaiduOAuthTokens> {
  return requestBaiduTokens(config, { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri })
}

export async function refreshBaiduTokens(
  config: BaiduOAuthConfig,
  refreshToken: string,
): Promise<BaiduOAuthTokens> {
  return requestBaiduTokens(config, { grant_type: 'refresh_token', refresh_token: refreshToken })
}

async function requestBaiduTokens(
  config: BaiduOAuthConfig,
  parameters: Record<string, string>,
): Promise<BaiduOAuthTokens> {
  const url = new URL('https://openapi.baidu.com/oauth/2.0/token')
  url.search = new URLSearchParams({
    ...parameters,
    client_id: config.appKey,
    client_secret: config.secretKey,
  }).toString()
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  const payload: unknown = await response.json()
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new Error('exchange_failed')
  }
  const data = payload as Record<string, unknown>
  if (
    data.error ||
    typeof data.access_token !== 'string' || !data.access_token.trim() ||
    typeof data.refresh_token !== 'string' || !data.refresh_token.trim() ||
    typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 || data.expires_in > 366 * 24 * 60 * 60
  ) throw new Error('exchange_failed')

  const scope = typeof data.scope === 'string' ? data.scope : ''
  if (!scope.split(/[\s,]+/).includes('netdisk')) throw new Error('exchange_failed')

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope,
  }
}
