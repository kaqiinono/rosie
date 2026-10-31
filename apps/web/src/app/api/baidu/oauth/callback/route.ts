import { verifyBaiduAccount } from '@/lib/baidu-identity'
import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase, isAdminRequestUser } from '@/lib/api-auth'
import {
  BAIDU_COOKIE_PATH,
  BAIDU_PERSONAL_STATE_PREFIX,
  BAIDU_STATE_COOKIE,
  exchangeBaiduCode,
  getBaiduOAuthConfig,
  type BaiduOAuthConfig,
  type BaiduOAuthTokens,
} from '@/lib/baidu-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OAuthResult =
  | 'success'
  | 'unauthorized'
  | 'invalid_state'
  | 'cancelled'
  | 'forbidden'
  | 'config_error'
  | 'storage_error'
  | 'exchange_failed'
  | 'identity_failed'

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const personal = state.startsWith(BAIDU_PERSONAL_STATE_PREFIX)
  const nonce = personal ? state.slice(BAIDU_PERSONAL_STATE_PREFIX.length) : state
  const cookieName = BAIDU_STATE_COOKIE[personal ? 'personal' : 'shared']

  function finish(result: OAuthResult) {
    const destination = new URL(personal ? '/setting' : '/admin/sync', req.url)
    destination.searchParams.set('baidu_oauth', result)
    destination.hash = 'baidu-oauth'
    const response = NextResponse.redirect(destination, 303)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: BAIDU_COOKIE_PATH,
      maxAge: 0,
    })
    return response
  }

  const cookie = req.cookies.get(cookieName)?.value ?? ''
  if (
    !/^[a-f0-9]{64}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(cookie) ||
    !timingSafeEqual(Buffer.from(nonce), Buffer.from(cookie))
  )
    return finish('invalid_state')

  let config: BaiduOAuthConfig
  try {
    config = getBaiduOAuthConfig()
  } catch {
    return finish('config_error')
  }
  if (req.nextUrl.origin !== new URL(config.redirectUri).origin) return finish('config_error')

  let admin: ReturnType<typeof createAdminSupabase>
  let initiatedBy: string
  try {
    admin = createAdminSupabase()
    // DELETE ... RETURNING consumes the attempt exactly once across server instances.
    const { data, error } = await admin
      .from('baidu_oauth_states')
      .delete()
      .eq('state_hash', createHash('sha256').update(state).digest('hex'))
      .eq('app_key', config.appKey)
      .eq('redirect_uri', config.redirectUri)
      .gt('expires_at', new Date().toISOString())
      .select('initiated_by')
      .maybeSingle()
    if (error) return finish('storage_error')
    if (!data || typeof data.initiated_by !== 'string') return finish('invalid_state')
    initiatedBy = data.initiated_by
    const { data: actor, error: actorError } = await admin.auth.admin.getUserById(initiatedBy)
    if (actorError || !actor.user) return finish('unauthorized')
    if (!personal && !isAdminRequestUser(actor.user)) return finish('forbidden')
  } catch {
    return finish('storage_error')
  }

  if (req.nextUrl.searchParams.has('error')) return finish('cancelled')
  const code = req.nextUrl.searchParams.get('code')
  if (!code || code.length > 4096) return finish('exchange_failed')

  let tokens: BaiduOAuthTokens
  try {
    tokens = await exchangeBaiduCode(config, code)
  } catch {
    // Never return or log upstream responses: they can contain credentials.
    return finish('exchange_failed')
  }

  let accountId: string
  try {
    accountId = await verifyBaiduAccount(tokens.accessToken)
  } catch {
    return finish('identity_failed')
  }

  const credentials = {
    account_id: accountId,
    app_key: config.appKey,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt,
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }
  try {
    const { error } = personal
      ? await admin.from('baidu_user_oauth_credentials').upsert(
          { ...credentials, user_id: initiatedBy }, { onConflict: 'user_id' },
        )
      : await admin.rpc('baidu_store_verified_credentials', {
          p_input: { ...credentials, authorized_by: initiatedBy },
        })
    return finish(error ? 'storage_error' : 'success')
  } catch {
    return finish('storage_error')
  }
}
