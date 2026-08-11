import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
  if (!token) return null

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
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
