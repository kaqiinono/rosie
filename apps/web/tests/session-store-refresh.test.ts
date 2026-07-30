import { describe, it, expect, vi } from 'vitest'
import { createUserSessionStore } from '@rosie/core'

describe('createUserSessionStore.refreshInBackground', () => {
  it('keeps ready data visible while a background refresh runs', async () => {
    let resolveFetch!: (v: string[]) => void
    const fetch = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const store = createUserSessionStore<string[]>('test_bg_refresh_' + Math.random(), {
      fetch,
      empty: [],
    })

    // Prime to ready with first fetch via ensureLoaded path:
    const p1 = store.ensureLoaded('u1')
    resolveFetch(['a'])
    await p1
    expect(store.getSnapshot('u1').status).toBe('ready')
    expect(store.getSessionData('u1')).toEqual(['a'])

    let resolve2!: (v: string[]) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          resolve2 = resolve
        }),
    )

    const bg = store.refreshInBackground('u1')
    expect(store.getSnapshot('u1').status).toBe('ready')
    expect(store.getSessionData('u1')).toEqual(['a'])

    resolve2(['b'])
    await bg
    expect(store.getSessionData('u1')).toEqual(['b'])
    expect(store.getSnapshot('u1').status).toBe('ready')
  })

  it('coalesces into ensureLoaded when still idle', async () => {
    const fetch = vi.fn(async () => ['x'])
    const store = createUserSessionStore<string[]>('test_bg_idle_' + Math.random(), {
      fetch,
      empty: [],
    })
    await store.refreshInBackground('u1')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.getSessionData('u1')).toEqual(['x'])
  })
})
