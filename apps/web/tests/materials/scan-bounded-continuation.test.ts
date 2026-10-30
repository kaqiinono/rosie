import { it, expect, vi } from 'vitest'
const f = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}))
vi.mock('@/lib/api-auth', () => ({
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ single: async () => ({ data: f.row, error: null }) }) }),
      }),
    }),
    rpc: f.rpc,
  }),
}))
vi.mock('@/lib/baidu-token', () => ({
  getBaiduAccountContext: async () => ({
    accountId: '9223372036854775806',
    generation: 'g',
    accessToken: 'fixture',
  }),
}))
import { scanMaterialDirectory, advanceScan } from '@/lib/baidu-material-catalog'
it('bounds completed continuation responses while retaining every server-side inventory entry', async () => {
  const entries = Array.from({ length: 20000 }, (_, i) => ({
    account_id: '9223372036854775806',
    fs_id: String(BigInt('9223372036854700000') + BigInt(i)),
    path: `/airosie/english/file-${i}.mp3`,
    name: `file-${i}.mp3`,
    mime: 'application/octet-stream',
    size: 123,
    isdir: false,
  }))
  f.row = {
    revision: 18,
    account_id: '9223372036854775806',
    account_generation: 'g',
    root_id: 'english',
    path: '/airosie/english',
    recursive: true,
    subject: 'english',
    state: { entries, queue: [{ path: '/airosie/english', offset: 20000 }], complete: false },
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"errno":0,"list":[]}')))
  const page = await scanMaterialDirectory(
    {
      rootId: 'english',
      relativePath: '',
      recursive: true,
      subject: 'english',
      sessionId: 'scan',
      cursor: '18',
    },
    'owner',
  )
  expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(131072)
  expect(page).toMatchObject({
    complete: true,
    revision: 19,
    cursor: null,
    fileCount: 20000,
    nextResultOffset: 100,
  })
  expect(page.files).toHaveLength(100)
  expect(f.rpc.mock.calls[0][1].p_state.entries).toHaveLength(20000)
  expect(f.rpc.mock.calls[0][1]).toMatchObject({
    p_account: '9223372036854775806',
    p_generation: 'g',
    p_revision: 18,
    p_user: 'owner',
  })
  vi.unstubAllGlobals()
})
it('rejects overlong provider paths without altering a prior checkpoint', async () => {
  const state = { queue: [{ path: '/airosie/english', offset: 0 }], entries: [], complete: false }
  await expect(
    advanceScan(state, '1', true, async () => [
      { fs_id: '2', path: '/airosie/english/' + 'x'.repeat(4096), isdir: 0, size: 1 },
    ]),
  ).rejects.toThrow('baidu_invalid_path')
  expect(state).toEqual({
    queue: [{ path: '/airosie/english', offset: 0 }],
    entries: [],
    complete: false,
  })
})
