import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders, getRateLimitPolicy, isLocallyRateLimited } from '@/lib/rate-limit'

describe('API rate limiting', () => {
  it('uses stricter limits for sensitive and costly endpoints', () => {
    expect(getRateLimitPolicy('/api/forgot-password').maxRequests).toBe(3)
    expect(getRateLimitPolicy('/api/word-enrich').maxRequests).toBe(10)
    expect(getRateLimitPolicy('/api/ai/transcribe').maxRequests).toBe(15)
    expect(getRateLimitPolicy('/api/admin/users').maxRequests).toBe(60)
  })

  it('uses the first trusted forwarded IP', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.7')
  })

  it('falls back to a bounded local counter', () => {
    const key = `test-${crypto.randomUUID()}`
    const policy = { maxRequests: 2, windowMs: 60_000 }
    expect(isLocallyRateLimited(key, policy)).toBe(false)
    expect(isLocallyRateLimited(key, policy)).toBe(false)
    expect(isLocallyRateLimited(key, policy)).toBe(true)
  })
})
