import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Simple in-memory sliding window rate limiter for API routes.
 * Suitable for single-user deployment (Vercel edge functions are stateless,
 * but serverless function instances may persist state briefly).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries periodically
const CLEANUP_INTERVAL = 60_000 // 60s
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  cleanup()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > maxRequests
}

/**
 * Apply rate limiting to API routes.
 * - /api/word-enrich: 10 requests per minute (calls Anthropic API)
 * - /api/word-image: 20 requests per minute
 * - /api/forgot-password: 3 requests per minute (sensitive operation)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Use IP + path as the rate limit key
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const key = `${ip}:${pathname}`

  let maxRequests = 20
  let windowMs = 60_000

  if (pathname === '/api/word-enrich') {
    maxRequests = 10
    windowMs = 60_000
  } else if (pathname === '/api/forgot-password') {
    maxRequests = 3
    windowMs = 60_000
  }

  if (isRateLimited(key, maxRequests, windowMs)) {
    return NextResponse.json(
      { error: 'too_many_requests', message: '请求过于频繁，请稍后再试' },
      { status: 429 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
