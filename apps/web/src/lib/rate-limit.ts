export interface RateLimitPolicy {
  maxRequests: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const localStore = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60_000

export function getRateLimitPolicy(pathname: string): RateLimitPolicy {
  if (pathname === '/api/word-enrich') return { maxRequests: 10, windowMs: 60_000 }
  if (pathname === '/api/forgot-password') return { maxRequests: 3, windowMs: 60_000 }
  if (pathname === '/api/ai/chat') return { maxRequests: 20, windowMs: 60_000 }
  if (pathname === '/api/ai/transcribe') return { maxRequests: 15, windowMs: 60_000 }
  if (pathname.startsWith('/api/ai/knowledge')) {
    return { maxRequests: 30, windowMs: 60_000 }
  }
  if (pathname.startsWith('/api/admin/')) return { maxRequests: 60, windowMs: 60_000 }
  return { maxRequests: 20, windowMs: 60_000 }
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export function isLocallyRateLimited(key: string, policy: RateLimitPolicy): boolean {
  const now = Date.now()
  if (now - lastCleanup >= CLEANUP_INTERVAL) {
    lastCleanup = now
    for (const [entryKey, entry] of localStore) {
      if (entry.resetAt <= now) localStore.delete(entryKey)
    }
  }

  const entry = localStore.get(key)
  if (!entry || entry.resetAt <= now) {
    localStore.set(key, { count: 1, resetAt: now + policy.windowMs })
    return false
  }
  entry.count += 1
  return entry.count > policy.maxRequests
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Returns null when the distributed backend is unavailable, allowing local fallback. */
export async function isDistributedRateLimited(input: {
  identity: string
  pathname: string
  policy: RateLimitPolicy
}): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  try {
    const keyHash = await sha256(input.identity)
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/check_api_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_route: input.pathname,
        p_limit: input.policy.maxRequests,
        p_window_seconds: Math.ceil(input.policy.windowMs / 1000),
      }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) === true
  } catch {
    return null
  }
}
