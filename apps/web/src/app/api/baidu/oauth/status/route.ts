import { NextResponse } from 'next/server'
import { baiduAuthErrorCode } from '@rosie/core'
import { createAdminSupabase, createAuthedSupabase, getBearerToken, isAdminRequestUser } from '@/lib/api-auth'
import { getBaiduOAuthConfig } from '@/lib/baidu-oauth'
import { getBaiduAccountContext } from '@/lib/baidu-token'
import { verifyBaiduAccount } from '@/lib/baidu-identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function status(req: Request) {
  const token = getBearerToken(req)
  if (!token) return fail('unauthorized', 401)
  try {
    const { data, error } = await createAuthedSupabase(token).auth.getUser(token)
    if (error) return fail(error.status && [400, 401, 403].includes(error.status) ? 'unauthorized' : 'auth_unavailable',
      error.status && [400, 401, 403].includes(error.status) ? 401 : 503)
    if (!data.user) return fail('unauthorized', 401)
    if (!isAdminRequestUser(data.user)) return fail('forbidden', 403)
  } catch { return fail('auth_unavailable', 503) }

  let expiresAt: string | null = null
  try {
    const config = getBaiduOAuthConfig()
    const { data, error } = await createAdminSupabase().from('baidu_oauth_credentials')
      .select('app_key, expires_at, refresh_lock_id, refresh_lock_until').eq('id', 'primary').maybeSingle()
    if (error) throw Error('baidu_storage_error')
    if (!data) return NextResponse.json({ state: 'baidu_not_authorized', expiresAt: null }, { headers })
    expiresAt = data.expires_at
    let state = 'unchecked'
    if (data.app_key !== config.appKey) state = 'baidu_reauthorize'
    else if (data.refresh_lock_id && (!data.refresh_lock_until || Date.parse(data.refresh_lock_until) <= Date.now())) state = 'baidu_refresh_uncertain'
    if (req.method === 'GET' || state !== 'unchecked') {
      return NextResponse.json({ state, expiresAt, ...(req.method === 'POST' ? { checkedAt: new Date().toISOString() } : {}) }, { headers })
    }
    const account = await getBaiduAccountContext()
    expiresAt = account.expiresAt
    if (await verifyBaiduAccount(account.accessToken) !== account.accountId) throw Error('baidu_account_changed')
    const current = await getBaiduAccountContext()
    if (current.generation !== account.generation || current.accessToken !== account.accessToken) throw Error('baidu_account_changed')
    return NextResponse.json({ state: 'valid', expiresAt: account.expiresAt, checkedAt: new Date().toISOString() }, { headers })
  } catch (error) {
    const code = error instanceof Error && error.message === 'baidu_access_token_rejected'
      ? 'baidu_reauthorize' : baiduAuthErrorCode(error)
    if (code) return NextResponse.json({ state: code, expiresAt, checkedAt: new Date().toISOString() }, { headers })
    return fail('status_unavailable', 503)
  }
}

export { status as GET, status as POST }
