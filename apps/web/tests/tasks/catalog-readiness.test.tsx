import { act, renderHook, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWordData, wordEntriesStore } from '../../../../packages/english/src/hooks/useWordData'
import { useChineseBookLessons } from '../../../../packages/chinese/src/hooks/useChineseBookLessons'

const chinese = vi.hoisted(() => ({ cache: {} as Record<string, { lessons: []; lessonGroups: [] }>, ensure: vi.fn(), error: null as unknown | null }))
vi.mock('../../../../packages/chinese/src/hooks/useChineseRoadmapProgress', () => ({
  chineseRoadmapCatalogStore: { useSessionData: () => ({ data: chinese.cache, isLoading: false, error: chinese.error }) },
  ensureBookCatalog: chinese.ensure,
}))
vi.mock('@rosie/core', async importOriginal => ({ ...await importOriginal<typeof import('@rosie/core')>(), useAuth: () => ({ user }) }))
const user = { id: 'catalog-user' } as User

afterEach(() => { vi.restoreAllMocks(); chinese.cache = {}; chinese.error = null; chinese.ensure.mockReset() })

describe('catalog hook readiness without new requests', () => {
  it('distinguishes vocabulary loading, ready-empty and failed reads while retaining old fields', () => {
    const state = { data: [], isLoading: true, error: null as unknown | null }
    vi.spyOn(wordEntriesStore, 'useSessionData').mockImplementation(() => state)
    const { result, rerender } = renderHook(() => useWordData(user))
    expect(result.current.ready).toBe(false)
    expect(result.current.vocab).toEqual([])
    expect(typeof result.current.addWords).toBe('function')
    state.isLoading = false
    rerender()
    expect(result.current.ready).toBe(true)
    const failure = new Error('catalog offline')
    state.error = failure
    rerender()
    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBe(failure)
  })
  it('exposes the actual Chinese fetch error without treating failed-empty as ready', async () => {
    const failure = new Error('Chinese offline')
    chinese.ensure.mockRejectedValue(failure)
    const { result } = renderHook(() => useChineseBookLessons('g2a'))
    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current).toMatchObject({ ready: false, isLoading: false, lessons: [], lessonGroups: [] })
    expect(chinese.ensure).toHaveBeenCalledTimes(1)
  })
  it('reuses a loaded Chinese book on remount, preserving ready-empty and cache errors distinctly', async () => {
    chinese.cache = { g2a: { lessons: [], lessonGroups: [] } }
    const first = renderHook(() => useChineseBookLessons('g2a'))
    expect(first.result.current.ready).toBe(true)
    first.unmount()
    const second = renderHook(() => useChineseBookLessons('g2a'))
    expect(second.result.current.ready).toBe(true)
    expect(chinese.ensure).not.toHaveBeenCalled()
    await act(async () => { chinese.error = new Error('cache failed') })
    second.rerender()
    expect(second.result.current.ready).toBe(false)
    expect(second.result.current.error).toBe(chinese.error)
  })
})
