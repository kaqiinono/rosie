export async function getProjectStorageAccount(env) {
  const origin = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!origin || !key) throw Error('Project Storage requires Supabase server credentials.')
  const url = new URL('/rest/v1/baidu_oauth_credentials', origin)
  url.search = new URLSearchParams({
    id: 'eq.primary', select: 'access_token,account_id,account_generation,expires_at,refresh_lock_id',
  }).toString()
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000), redirect: 'error', cache: 'no-store',
  })
  if (!response.ok) throw Error(`Shared Baidu credential lookup failed (${response.status}).`)
  const [row] = await response.json()
  if (!row?.account_id || !row.account_generation || row.refresh_lock_id ||
      !row.access_token || !(Date.parse(row.expires_at) > Date.now() + 120_000)) {
    throw Error('在 Rosie 同步管理中检查并续期共享百度网盘授权后重试。')
  }
  return { key: row.account_generation, token: row.access_token }
}
