import { describe, it, expect, vi } from 'vitest'
import { createUserSessionStore, refreshSessionStore } from '@rosie/core'

describe('createUserSessionStore.refreshInBackground', () => {
  it('refreshes after a mutation even when the derived store is still initially loading', async () => {
    let finishInitial!: (value: string[]) => void
    const key = 'test_mutation_loading_' + Math.random()
    const fetch = vi.fn(async () => ['new homework'])
    fetch.mockImplementationOnce(() => new Promise(resolve => { finishInitial = resolve }))
    const store = createUserSessionStore<string[]>(key, { empty: [], fetch })
    const initial = store.ensureLoaded('child')
    const refreshed = refreshSessionStore(key, 'child')
    finishInitial(['old homework'])
    await initial
    await refreshed
    expect(store.getSessionData('child')).toEqual(['new homework'])
    expect(store.getSnapshot('another-child').status).toBe('idle')
  })

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
