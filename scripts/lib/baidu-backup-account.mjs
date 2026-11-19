import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const MIN_TOKEN_LIFETIME = 15 * 60_000

export async function getBackupBaiduAccount(env) {
  const { NEXT_PUBLIC_SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    BAIDU_APP_KEY: appKey, BAIDU_SECRET_KEY: appSecret } = env
  if (!origin || !serviceKey || !appKey || !appSecret) throw Error('baidu_backup_configuration_missing')

  async function credentials(filters, updates) {
    const url = new URL('/rest/v1/baidu_oauth_credentials', origin)
    url.search = new URLSearchParams(filters).toString()
    const response = await fetch(url, {
      method: updates ? 'PATCH' : 'GET',
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        ...(updates ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
      },
      body: updates ? JSON.stringify(updates) : undefined,
      signal: AbortSignal.timeout(10_000), redirect: 'error', cache: 'no-store',
    })
    if (!response.ok) throw Error('baidu_backup_credential_store_unavailable')
    const rows = await response.json()
    if (!Array.isArray(rows) || rows.length > 1) throw Error('baidu_backup_credential_store_unavailable')
    return rows[0]
  }

  // The site uses the same lease and version guard for its shared authorization.
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = await credentials({ id: 'eq.primary', select:
      'access_token,refresh_token,expires_at,app_key,account_id,account_generation,updated_at,refresh_lock_id,refresh_lock_until' })
    if (!row?.account_id || !row.account_generation || row.app_key !== appKey) {
      throw Error('baidu_backup_reauthorize_shared_account')
    }
    if (row.refresh_lock_id) {
      if (!(Date.parse(row.refresh_lock_until) > Date.now())) throw Error('baidu_backup_refresh_uncertain')
      await delay(800)
      continue
    }
    if (row.access_token && Date.parse(row.expires_at) > Date.now() + MIN_TOKEN_LIFETIME) {
      return { token: row.access_token, generation: row.account_generation }
    }

    const lease = randomUUID()
    const guard = { id: 'eq.primary', updated_at: `eq.${row.updated_at}`, select: 'id' }
    const claimed = await credentials({ ...guard, refresh_lock_id: 'is.null' }, {
      refresh_lock_id: lease, refresh_lock_until: new Date(Date.now() + 60_000).toISOString(),
    })
    if (!claimed) continue

    // A lost refresh response may have already consumed the token. Keep the lease on failure.
    try {
      const url = new URL('https://openapi.baidu.com/oauth/2.0/token')
      url.search = new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: row.refresh_token, client_id: appKey, client_secret: appSecret,
      }).toString()
      const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      const token = await response.json()
      if (!response.ok || token.error || typeof token.access_token !== 'string' || !token.access_token.trim() ||
        typeof token.refresh_token !== 'string' || !token.refresh_token.trim() ||
        typeof token.expires_in !== 'number' || !Number.isFinite(token.expires_in) ||
        token.expires_in < MIN_TOKEN_LIFETIME / 1000 || token.expires_in > 366 * 86400 ||
        typeof token.scope !== 'string' || !token.scope.split(/[\s,]+/).includes('netdisk')) {
        throw Error('baidu_backup_refresh_uncertain')
      }
      await credentials({ ...guard, refresh_lock_id: `eq.${lease}` }, {
        access_token: token.access_token, refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        scope: token.scope, updated_at: new Date().toISOString(), refresh_lock_id: null, refresh_lock_until: null,
      })
    } catch {
      throw Error('baidu_backup_refresh_uncertain')
    }
  }
  throw Error('baidu_backup_refresh_busy')
}
