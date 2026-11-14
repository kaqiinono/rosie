import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((fulfill) => { resolve = fulfill })
  return { promise, resolve }
}

function waitForAbort<T>(signal: AbortSignal | null | undefined): Promise<T> {
  if (!signal) throw new Error('Expected an abort signal')
  return new Promise<T>((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

describe('distributed rate-limit availability', () => {
  const input = {
    identity: '203.0.113.7',
    pathname: '/api/word-enrich',
    policy: { maxRequests: 10, windowMs: 60_000 },
  }
  const fetchMock = vi.fn<typeof fetch>()
  let limited: typeof import('@/lib/rate-limit').isDistributedRateLimited

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00Z'))
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://stub.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role')
    vi.stubGlobal('crypto', webcrypto)
    vi.stubGlobal('fetch', fetchMock.mockReset())
    limited = (await import('@/lib/rate-limit')).isDistributedRateLimited
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(['fetch', 'body'])('bounds a hung %s within the same 1500 ms budget', async (stage) => {
    const started = deferred<void>()
    const settled = vi.fn()
    fetchMock.mockImplementation(async (_, init) => {
      started.resolve()
      if (stage === 'fetch') return waitForAbort<Response>(init?.signal)
      await new Promise((resolve) => setTimeout(resolve, 500))
      const response = new Response()
      vi.spyOn(response, 'json').mockImplementation(() => waitForAbort(init?.signal))
      return response
    })

    const request = limited(input).then((result) => { settled(result); return result })
    await started.promise
    await vi.advanceTimersByTimeAsync(1499)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await request).toBeNull()
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(await limited(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['http', 'network', 'json', 'nonboolean'])('opens cooldown after a %s failure', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    else fetchMock.mockResolvedValueOnce(new Response(
      failure === 'json' ? '{' : '{}',
      { status: failure === 'http' ? 503 : 200 },
    ))

    expect(await limited(input)).toBeNull()
    await vi.advanceTimersByTimeAsync(29_999)
    expect(await limited(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([true, false])('allows one recovery probe and closes cooldown on %s', async (result) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    expect(await limited(input)).toBeNull()
    await vi.advanceTimersByTimeAsync(30_000)

    const response = deferred<Response>()
    const started = deferred<void>()
    fetchMock.mockImplementationOnce(() => { started.resolve(); return response.promise })
    const probe = limited(input)
    await started.promise
    expect(await limited(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    response.resolve(Response.json(result))
    expect(await probe).toBe(result)
    fetchMock.mockResolvedValueOnce(Response.json(false))
    expect(await limited(input)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not let an older success clear a newer failure cooldown', async () => {
    const response = deferred<Response>()
    const started = deferred<void>()
    fetchMock.mockImplementationOnce(() => { started.resolve(); return response.promise })
    const olderRequest = limited(input)
    await started.promise

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await limited(input)).toBeNull()
    response.resolve(Response.json(false))
    expect(await olderRequest).toBe(false)
    expect(await limited(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
