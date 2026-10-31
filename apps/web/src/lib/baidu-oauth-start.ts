import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  createAdminSupabase, createAuthedSupabase, getBearerToken, isAdminRequestUser,
} from '@/lib/api-auth'
import {
  BAIDU_COOKIE_PATH, BAIDU_PERSONAL_STATE_PREFIX, BAIDU_STATE_COOKIE, BAIDU_STATE_TTL_SECONDS,
  baiduAuthorizationUrl, getBaiduOAuthConfig,
  type BaiduOAuthConfig, type BaiduOAuthTarget,
} from '@/lib/baidu-oauth'

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function startBaiduOAuth(req: Request, target: BaiduOAuthTarget) {
  const token = getBearerToken(req)
  if (!token) return failure('unauthorized', 401)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return failure('auth_config_error', 503)
  }
  let actor: User
  try {
    const { data, error } = await createAuthedSupabase(token).auth.getUser(token)
    if (error) {
      return failure(
        error.status && [400, 401, 403].includes(error.status) ? 'unauthorized' : 'auth_unavailable',
        error.status && [400, 401, 403].includes(error.status) ? 401 : 503,
      )
    }
    if (!data.user) return failure('unauthorized', 401)
    actor = data.user
  } catch {
    return failure('auth_unavailable', 503)
  }
  if (target === 'shared' && !isAdminRequestUser(actor)) return failure('forbidden', 403)

  let config: BaiduOAuthConfig
  try {
    config = getBaiduOAuthConfig()
  } catch {
    return failure('config_error', 503)
  }
  const callback = new URL(config.redirectUri)
  if (new URL(req.url).origin !== callback.origin) return failure('origin_mismatch', 400)

  const nonce = randomBytes(32).toString('hex')
  const state = target === 'personal' ? BAIDU_PERSONAL_STATE_PREFIX + nonce : nonce
  try {
    const admin = createAdminSupabase()
    // Remove expired attempts without touching credentials or live authorizations.
    const { error: cleanupError } = await admin.from('baidu_oauth_states')
      .delete().lt('expires_at', new Date().toISOString())
    if (cleanupError) return failure('storage_error', 503)
    const { error } = await admin.from('baidu_oauth_states').insert({
      state_hash: createHash('sha256').update(state).digest('hex'),
      initiated_by: actor.id,
      app_key: config.appKey,
      redirect_uri: config.redirectUri,
      expires_at: new Date(Date.now() + BAIDU_STATE_TTL_SECONDS * 1000).toISOString(),
    })
    if (error) return failure('storage_error', 503)
  } catch {
    return failure('storage_error', 503)
  }

  const response = NextResponse.json({ url: baiduAuthorizationUrl(config, state) }, {
    headers: { 'Cache-Control': 'no-store' },
  })
  response.cookies.set(BAIDU_STATE_COOKIE[target], nonce, {
    httpOnly: true,
    secure: callback.protocol === 'https:',
    sameSite: 'lax',
    path: BAIDU_COOKIE_PATH,
    maxAge: BAIDU_STATE_TTL_SECONDS,
  })
  return response
}
