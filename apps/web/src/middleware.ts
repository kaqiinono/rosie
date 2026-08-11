import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  clientIpFromHeaders,
  getRateLimitPolicy,
  isDistributedRateLimited,
  isLocallyRateLimited,
} from '@/lib/rate-limit'

/**
 * Apply rate limiting to API routes.
 * - /api/word-enrich: 10 requests per minute (calls 百炼 / OpenAI-compatible API)
 * - /api/word-image: 20 requests per minute
 * - /api/forgot-password: 3 requests per minute (sensitive operation)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Local / CLI knowledge sync uses service role — skip rate limit (route still validates the key).
  if (pathname.startsWith('/api/ai/knowledge')) {
    const provided = request.headers.get('x-service-role-key')
    const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (provided && expected && provided === expected) {
      return NextResponse.next()
    }
  }

  const ip = clientIpFromHeaders(request.headers)
  const identity = `${ip}:${pathname}`
  const policy = getRateLimitPolicy(pathname)
  const distributed = await isDistributedRateLimited({ identity, pathname, policy })
  const limited = distributed ?? isLocallyRateLimited(identity, policy)

  if (limited) {
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
