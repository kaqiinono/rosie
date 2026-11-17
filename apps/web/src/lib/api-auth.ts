import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const AUTH_LOOKUP_ATTEMPTS = 3
const AUTH_LOOKUP_TIMEOUT_MS = 2_500
type AuthUnavailableReason = 'timeout' | 'network_error' | 'rate_limited' | 'service_error' | 'configuration_error' | 'unavailable'
const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
])
const AUTH_ERROR_NAMES = new Set(['AuthApiError', 'AuthRetryableFetchError', 'AuthUnknownError', 'AuthSessionMissingError', 'AuthInvalidJwtError', 'AbortError', 'TimeoutError', 'TypeError', 'Error'])

export interface RequestUserLookup<Identity extends Pick<User, 'id'> = User> {
  user: Identity | null
  /** Verification could not complete; this is not a rejection of the user's session. */
  unreachable: boolean
  reason?: AuthUnavailableReason
}

type AuthFailure = { name?: string; status?: number; message?: string } | null
type AuthLookupOptions = { attempts?: number; timeoutMs?: number }

/** Keep only known transport codes, never error messages, URLs, headers or tokens. */
function networkErrorCodes(error: unknown, depth = 0): string[] {
  if (depth > 4 || !error || typeof error !== 'object') return []
  const value = error as { code?: unknown; cause?: unknown; errors?: unknown }
  return [...new Set([
    ...(typeof value.code === 'string' && NETWORK_ERROR_CODES.has(value.code) ? [value.code] : []),
    ...networkErrorCodes(value.cause, depth + 1),
    ...(Array.isArray(value.errors) ? value.errors.slice(0, 8).flatMap(item => networkErrorCodes(item, depth + 1)) : []),
  ])]
}

function isRetryableAuthFailure(error: AuthFailure): boolean {
  if (!error) return false
  if (error.name === 'AuthRetryableFetchError') return true
  const status = typeof error.status === 'number' ? error.status : 0
  return status === 0 || status === 429 || status >= 500
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A stalled auth request is aborted and retried. */
async function lookupRequestIdentity<Identity extends Pick<User, 'id'>>(
  req: Request,
  verify: (client: SupabaseClient, token: string, url: string) => Promise<{ user: Identity | null; error: AuthFailure }>,
  { attempts = AUTH_LOOKUP_ATTEMPTS, timeoutMs = AUTH_LOOKUP_TIMEOUT_MS }: AuthLookupOptions = {},
): Promise<RequestUserLookup<Identity>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.warn('[auth-lookup]', { reason: 'configuration_error', missingUrl: !url, missingAnonKey: !anonKey })
    return { user: null, unreachable: true, reason: 'configuration_error' }
  }

  const token = getBearerToken(req)
  if (!token) return { user: null, unreachable: false }

  let attemptController = new AbortController()
  let transportFailure: unknown
  const lookupId = crypto.randomUUID()
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, { ...init, signal: attemptController.signal })
        } catch (error) {
          // Capture the cause before the auth SDK wraps the transport error.
          transportFailure = error
          throw error
        }
      },
    },
  })
  let unreachable = false
  let reason: AuthUnavailableReason = 'unavailable'
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await delay(150 * attempt)
    attemptController = new AbortController()
    const controller = attemptController
    transportFailure = undefined
    const startedAt = Date.now()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let failure: AuthFailure = null
    try {
      const { user, error } = await verify(client, token, url)
      if (!error && user) return { user, unreachable: false }
      failure = error
    } catch (error) {
      failure = error instanceof Error ? error : { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }
    } finally {
      clearTimeout(timer)
    }
    const retryable = isRetryableAuthFailure(failure)
    const codes = networkErrorCodes(transportFailure ?? failure)
    const status = typeof failure?.status === 'number' && Number.isInteger(failure.status)
      && failure.status >= 100 && failure.status <= 599 ? failure.status : null
    reason = controller.signal.aborted || codes.some(code => code.includes('TIMEOUT') || code === 'ETIMEDOUT') ? 'timeout'
      : status === 429 ? 'rate_limited'
      : status !== null && status >= 500 ? 'service_error'
      : transportFailure || failure?.name === 'AuthRetryableFetchError' ? 'network_error' : 'unavailable'
    console.warn('[auth-lookup]', {
      lookupId, attempt: attempt + 1, maxAttempts: attempts,
      elapsedMs: Date.now() - startedAt, timeoutMs,
      reason: retryable ? reason : 'rejected', status,
      errorName: failure?.name && AUTH_ERROR_NAMES.has(failure.name) ? failure.name : 'UnknownError',
      networkCodes: codes, retrying: retryable && attempt + 1 < attempts,
    })
    if (!retryable) return { user: null, unreachable: false }
    unreachable = true
  }
  return { user: null, unreachable, reason }
}

export function lookupUserFromRequest(req: Request, options?: AuthLookupOptions): Promise<RequestUserLookup> {
  return lookupRequestIdentity(req, async (client, token) => {
    const { data, error } = await client.auth.getUser(token)
    return { user: error ? null : data.user, error }
  }, options)
}

export function lookupUserFromClaims(
  req: Request,
  options?: AuthLookupOptions,
): Promise<RequestUserLookup<{ id: string; verifiedOnline: boolean }>> {
  return lookupRequestIdentity(req, async (client, token, url) => {
    const { data, error } = await client.auth.getClaims(token).catch((failure: unknown) => {
      // The SDK throws plain errors for invalid alg and exp claims.
      const invalidJwt = failure instanceof SyntaxError || failure instanceof TypeError ||
        (failure instanceof Error && ['Invalid alg claim', 'Missing exp claim', 'JWT has expired'].includes(failure.message))
      if (!invalidJwt) throw failure
      return { data: null, error: { name: 'AuthInvalidJwtError', status: 400 } }
    })
    if (error || !data) return { user: null, error }

    const { sub, iss, aud, exp, nbf, role } = data.claims
    const now = Date.now() / 1000
    const hasAudience = aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated'))
    const valid = typeof sub === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(sub) &&
      iss === `${url.replace(/\/+$/, '')}/auth/v1` && role === 'authenticated' && hasAudience &&
      Number.isFinite(exp) && exp > now && (nbf === undefined || (Number.isFinite(nbf) && nbf <= now))
    if (!valid) return { user: null, error: null }

    // The SDK verifies HS256 with getUser. Asymmetric tokens can use cached keys.
    return { user: { id: sub, verifiedOnline: data.header.alg === 'HS256' }, error: null }
  }, options)
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const { user } = await lookupUserFromRequest(req)
  return user
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export function createAuthedSupabase(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('missing_supabase_env')

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/** Create inside a request handler; never share a service-role client across requests. */
export function createAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('missing_admin_env')

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim()
}

function csvEnvIncludes(raw: string | undefined, value: string | undefined): boolean {
  if (!raw || !value) return false
  const normalized = value.trim().toLowerCase()
  return raw.split(',').some((item) => item.trim().toLowerCase() === normalized)
}

/** app_metadata is authoritative; env allowlists support a safe rollout for the first admin. */
export function isAdminRequestUser(user: User): boolean {
  return (
    user.app_metadata?.role === 'admin' ||
    csvEnvIncludes(process.env.ADMIN_USER_IDS, user.id) ||
    csvEnvIncludes(process.env.ADMIN_EMAILS, user.email)
  )
}

export async function requireAdminFromRequest(req: Request): Promise<User | null> {
  const user = await getUserFromRequest(req)
  return user && isAdminRequestUser(user) ? user : null
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}
