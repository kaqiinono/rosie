import 'server-only'
import { exactBaiduId } from './baidu-identity'
import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from './api-auth'
import { getBaiduOAuthConfig, refreshBaiduTokens } from './baidu-oauth'

interface CredentialRow {
  account_id: string | null
  account_generation: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  updated_at: string
  app_key: string
  refresh_lock_id: string | null
  refresh_lock_until: string | null
}

let inflight: Promise<string> | null = null

/** Single-flight locally; the database lease also serializes separate server instances. */
export function getBaiduAccessToken(): Promise<string> {
  if (!inflight) {
    inflight = loadAccessToken().finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function loadAccessToken(): Promise<string> {
  const config = getBaiduOAuthConfig()
  const admin = createAdminSupabase()
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const { data, error } = await admin
      .from('baidu_oauth_credentials')
      .select(
        'access_token, refresh_token, expires_at, updated_at, app_key, refresh_lock_id, refresh_lock_until',
      )
      .eq('id', 'primary')
      .maybeSingle()
    if (error) throw new Error('baidu_storage_error')
    if (!data || data.app_key !== config.appKey) throw new Error('baidu_reauthorize')
    const row = data as CredentialRow
    if (row.refresh_lock_id) {
      if (!row.refresh_lock_until || Date.parse(row.refresh_lock_until) <= Date.now()) {
        // A crashed/ambiguous refresh may already have consumed the rotating token.
        throw new Error('baidu_reauthorize')
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 800))
      continue
    }
    if (Date.parse(row.expires_at) > Date.now() + 120_000) return row.access_token

    const leaseId = randomUUID()
    const { data: claimed, error: claimError } = await admin
      .from('baidu_oauth_credentials')
      .update({
        refresh_lock_id: leaseId,
        refresh_lock_until: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq('id', 'primary')
      .eq('updated_at', row.updated_at)
      .is('refresh_lock_id', null)
      .select('id')
      .maybeSingle()
    if (claimError) throw new Error('baidu_storage_error')
    if (!claimed) continue

    // Leave the lease in place if exchange/persistence fails: do not reuse an
    // ambiguously consumed refresh_token. Administrator reauthorization clears it.
    const tokens = await refreshBaiduTokens(config, row.refresh_token)
    const { data: saved, error: saveError } = await admin
      .from('baidu_oauth_credentials')
      .update({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
        refresh_lock_id: null,
        refresh_lock_until: null,
      })
      .eq('id', 'primary')
      .eq('refresh_lock_id', leaseId)
      .eq('updated_at', row.updated_at)
      .select('id')
      .maybeSingle()
    if (saveError) throw new Error('baidu_storage_error')
    if (saved) return tokens.accessToken
    // A new administrator authorization won the race; reread its credentials.
  }
  throw new Error('baidu_refresh_busy')
}

/** Task9 must capture this context before provider work and guard publication with both fields. */
export async function getBaiduAccountContext() {
  const accessToken = await getBaiduAccessToken()
  const { data, error } = await createAdminSupabase()
    .from('baidu_oauth_credentials')
    .select('account_id,account_generation,access_token')
    .eq('id', 'primary')
    .maybeSingle()
  if (error || !data || data.access_token !== accessToken || !data.account_generation)
    throw Error('baidu_account_changed')
  return {
    accountId: exactBaiduId(data.account_id),
    generation: String(data.account_generation),
    accessToken,
  }
}
