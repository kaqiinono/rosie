import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CatalogSyncBusyError,
  catalogSyncRequestKey,
  resetCatalogSyncFlightsForTests,
  runCatalogSyncSingleFlight,
} from '../../src/lib/catalog-sync-flight'

describe('catalog sync single-flight', () => {
  beforeEach(() => resetCatalogSyncFlightsForTests())

  it('reuses an identical in-flight request', async () => {
    let finish: ((value: string) => void) | undefined
    const run = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const key = catalogSyncRequestKey(['chinese', 'english'], {
      mathOffset: 0,
      mathLimit: 80,
    })

    const first = runCatalogSyncSingleFlight({ key, subjects: ['chinese', 'english'], run })
    const retry = runCatalogSyncSingleFlight({ key, subjects: ['chinese', 'english'], run })

    expect(first.reused).toBe(false)
    expect(retry.reused).toBe(true)
    expect(retry.promise).toBe(first.promise)
    expect(run).not.toHaveBeenCalled()

    await Promise.resolve()
    expect(run).toHaveBeenCalledTimes(1)
    finish?.('done')
    await expect(retry.promise).resolves.toBe('done')
  })

  it('reuses a recently completed request', async () => {
    let now = 1_000
    const run = vi.fn().mockResolvedValue('done')
    const key = catalogSyncRequestKey(['chinese'], { mathOffset: 0, mathLimit: 80 })

    const first = runCatalogSyncSingleFlight({ key, subjects: ['chinese'], run, now: () => now })
    await first.promise
    await Promise.resolve()
    now += 1_000
    const retry = runCatalogSyncSingleFlight({ key, subjects: ['chinese'], run, now: () => now })

    expect(retry.reused).toBe(true)
    await expect(retry.promise).resolves.toBe('done')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('rejects a different request that overlaps an active subject', async () => {
    const pending = new Promise<string>(() => undefined)
    runCatalogSyncSingleFlight({
      key: 'chinese-and-english',
      subjects: ['chinese', 'english'],
      run: () => pending,
    })

    expect(() =>
      runCatalogSyncSingleFlight({
        key: 'chinese-only',
        subjects: ['chinese'],
        run: async () => 'unexpected',
      }),
    ).toThrow(CatalogSyncBusyError)
  })
})
