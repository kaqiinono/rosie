import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMaterialData } from '../../../../packages/materials/src/useMaterialData'
const fixture = vi.hoisted(() => ({
  user: 'readiness-failure',
  read: async (_table: string): Promise<{ data: unknown[]; error: Error | null }> => ({
    data: [],
    error: null,
  }),
}))
vi.mock('@rosie/core', async (original) => ({
  ...(await original<typeof import('@rosie/core')>()),
  useAuth: () => ({ user: { id: fixture.user } }),
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        range: () => query,
        eq: () => query,
        then: (
          resolve: (value: { data: unknown[]; error: Error | null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => fixture.read(table).then(resolve, reject),
      }
      return query
    },
  },
}))
function deferred() {
  let resolve!: (value: { data: unknown[]; error: Error | null }) => void
  const promise = new Promise<{ data: unknown[]; error: Error | null }>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
describe('material forecast readiness with the real session store', () => {
  it('rejects a failed latest background refresh despite retaining ready display data', async () => {
    fixture.user = 'readiness-failure'
    fixture.read = async () => ({ data: [], error: null })
    const { result } = renderHook(() => useMaterialData())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await result.current.readyData()
    const failure = new Error('latest_read_failed')
    fixture.read = async () => ({ data: [], error: failure })
    await act(async () => {
      await expect(result.current.refresh()).rejects.toBe(failure)
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(failure)
    await expect(result.current.readyData()).rejects.toBe(failure)
  })
  it('waits for a concurrent ready-state refresh and returns its latest data', async () => {
    fixture.user = 'readiness-concurrent'
    fixture.read = async () => ({ data: [], error: null })
    const { result } = renderHook(() => useMaterialData())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await result.current.readyData()
    const latest = deferred()
    const fetch = vi.fn((table: string) =>
      table === 'material_assets' ? latest.promise : Promise.resolve({ data: [], error: null }),
    )
    fixture.read = fetch
    let refresh!: Promise<void>
    act(() => {
      refresh = result.current.refresh()
    })
    const other = renderHook(() => useMaterialData())
    let otherSettled = false
    const otherRead = other.result.current.readyData().then((data) => {
      otherSettled = true
      return data
    })
    let settled = false
    const read = result.current.readyData().then((data) => {
      settled = true
      return data
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(settled).toBe(false)
    expect(otherSettled).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
    const asset = { id: 'latest-ready-row' }
    await act(async () => {
      latest.resolve({ data: [asset], error: null })
      await refresh
    })
    expect((await read).assets).toEqual([asset])
    expect((await otherRead).assets).toEqual([asset])
  })
})
