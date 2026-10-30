import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { normalizeMaterialPath, advanceScan, type ScanState } from '@/lib/baidu-material-catalog'
import { parseBaiduJson } from '@/lib/baidu-identity'
describe('directory boundary', () => {
  it('rejects decoded traversal and arbitrary roots', () => {
    for (const p of ['../x', '%2e%2e/x', '%252e%252e/x', '/x', 'a%2fb', 'a\\b', 'a\0b'])
      expect(() => normalizeMaterialPath('english', p)).toThrow()
    expect(() => normalizeMaterialPath('personal', '')).toThrow()
    expect(normalizeMaterialPath('english', '5A/U3')).toBe('/airosie/english/5A/U3')
  })
  it('preserves exact numeric account and file identities', () => {
    expect(
      parseBaiduJson('{"uk":9223372036854775806,"list":[{"fs_id":9223372036854775807}]}'),
    ).toEqual({ uk: '9223372036854775806', list: [{ fs_id: '9223372036854775807' }] })
  })
  it('pages recursively and retries without losing identities', async () => {
    const f = (id: string, path: string, isdir = 0) => ({
      fs_id: id,
      path,
      isdir,
      size: 2,
      server_filename: path.split('/').at(-1),
    })
    let state: ScanState = {
      queue: [{ path: '/airosie/english', offset: 0 }],
      entries: [],
      complete: false,
    }
    const list = vi
      .fn()
      .mockResolvedValueOnce([f('1', '/airosie/english/sub', 1), f('2', '/airosie/english/a.mp3')])
      .mockRejectedValueOnce(Error('interrupted'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        f('2', '/airosie/english/sub/a.mp3'),
        f('3', '/airosie/english/sub/b.mp3'),
      ])
      .mockResolvedValueOnce([])
    state = await advanceScan(state, '12', true, list, 2)
    expect(state.complete).toBe(false)
    expect(state.entries).toHaveLength(2)
    await expect(advanceScan(state, '12', true, list, 2)).rejects.toThrow('interrupted')
    state = await advanceScan(state, '12', true, list, 2)
    state = await advanceScan(state, '12', true, list, 2)
    state = await advanceScan(state, '12', true, list, 2)
    expect(state.complete).toBe(true)
    expect(state.entries).toHaveLength(3)
    expect(state.entries.find((x: { fs_id: string }) => x.fs_id === '2')?.path).toContain('/sub/')
  })
})
it('verifies uk before account use and fails on unknown or rounded identity', async () => {
  const { verifyBaiduAccount, exactBaiduId } = await import('@/lib/baidu-identity')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('{"errno":0,"uk":9223372036854775806}'))
      .mockResolvedValueOnce(new Response('{"errno":0}')),
  )
  expect(await verifyBaiduAccount('fixture')).toBe('9223372036854775806')
  await expect(verifyBaiduAccount('fixture')).rejects.toThrow('baidu_invalid_identity')
  expect(() => exactBaiduId(9223372036854775807)).toThrow()
  vi.unstubAllGlobals()
})
