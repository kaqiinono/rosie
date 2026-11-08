import 'server-only'
import { exactBaiduId, verifyBaiduAccount } from './baidu-identity'
import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from './api-auth'
import { getBaiduOAuthConfig, refreshBaiduTokens, type BaiduOAuthTokens } from './baidu-oauth'

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

type BaiduAccountContext = { accountId: string; generation: string; accessToken: string; expiresAt: string }

let inflight: Promise<BaiduAccountContext> | null = null

/** Single-flight locally; the database lease also serializes separate server instances. */
export function getBaiduAccountContext(): Promise<BaiduAccountContext> {
  if (!inflight) {
    inflight = loadAccountContext().finally(() => {
      inflight = null
    })
  }
  return inflight
}

export async function getBaiduAccessToken(): Promise<string> {
  return (await getBaiduAccountContext()).accessToken
}

async function loadAccountContext(): Promise<BaiduAccountContext> {
  const config = getBaiduOAuthConfig()
  const admin = createAdminSupabase()
  let refreshedToken: string | undefined
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const { data, error } = await admin
      .from('baidu_oauth_credentials')
      .select(
        'account_id, account_generation, access_token, refresh_token, expires_at, updated_at, app_key, refresh_lock_id, refresh_lock_until',
      )
      .eq('id', 'primary')
      .maybeSingle()
    if (error) throw new Error('baidu_storage_error')
    if (!data) throw new Error('baidu_not_authorized')
    if (data.app_key !== config.appKey) throw new Error('baidu_reauthorize')
    const row = data as CredentialRow
    if (row.refresh_lock_id) {
      if (!row.refresh_lock_until || Date.parse(row.refresh_lock_until) <= Date.now()) {
        // A crashed/ambiguous refresh may already have consumed the rotating token.
        throw new Error('baidu_refresh_uncertain')
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 800))
      continue
    }
    if (Date.parse(row.expires_at) > Date.now() + 120_000) {
      const accessToken = row.access_token
      if (row.account_id !== null && row.account_generation !== null) {
        return { accountId: exactBaiduId(row.account_id), generation: row.account_generation, accessToken, expiresAt: row.expires_at }
      }
      // Pre-identity credentials can identify their owner without a new OAuth grant.
      let accountId: string | undefined
      try {
        accountId = await verifyBaiduAccount(accessToken)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'baidu_access_token_rejected') throw error
        if (accessToken === refreshedToken) throw new Error('baidu_reauthorize')
        // The provider rejected the stored token before its local expiry. Use the lease below.
      }
      if (accountId !== undefined) {
        if (row.account_id !== null && row.account_id !== accountId) throw new Error('baidu_account_changed')
        const generation = randomUUID()
        const { data: repaired, error: repairError } = await admin.from('baidu_oauth_credentials')
          .update({ account_id: accountId, account_generation: generation, updated_at: new Date().toISOString() })
          .eq('id', 'primary')
          .eq('updated_at', row.updated_at)
          .is(row.account_id === null ? 'account_id' : 'account_generation', null)
          .is('refresh_lock_id', null)
          .select('id').maybeSingle()
        if (repairError) throw new Error('baidu_storage_error')
        if (repaired) return { accountId, generation, accessToken, expiresAt: row.expires_at }
        continue // A refresh, another repair, or an explicit authorization won the race.
      }
    }

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
    let tokens: BaiduOAuthTokens
    try {
      tokens = await refreshBaiduTokens(config, row.refresh_token)
    } catch (error) {
      if (error instanceof Error && error.message === 'baidu_reauthorize') throw error
      throw Error('baidu_refresh_uncertain')
    }
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
    if (saveError) throw new Error('baidu_refresh_uncertain')
    if (saved) refreshedToken = tokens.accessToken
    // Reread the winner, including any identity still missing after a legacy refresh.
  }
  throw new Error('baidu_refresh_busy')
}

