import { it, expect, vi, afterEach } from 'vitest'
const f = vi.hoisted(() => ({ s: {} as Record<string, unknown>, createCount: 0 }))
vi.mock('@/lib/baidu-token', () => ({
  getBaiduAccountContext: async () => ({
    accountId: '100',
    generation: 'g',
    accessToken: 'secret',
  }),
}))
vi.mock('@/lib/api-auth', () => ({
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'asset' } }),
          eq: () => ({ maybeSingle: async () => ({ data: f.s }) }),
        }),
      }),
    }),
    rpc: async (_name: string, args: { p_action: string; p_data: Record<string, unknown> }) => {
      if (args.p_action === 'prepareclaim') {
        const claimed = f.s.state === 'initializing'
        f.s.state = 'preparing'
        return { data: { ...f.s, claimed } }
      }
      if (args.p_action === 'prepared') {
        f.s = { ...f.s, ...args.p_data, state: args.p_data.rapid ? 'merging' : 'uploading' }
        return { data: f.s }
      }
      if (args.p_action === 'claim') {
        const claimed = f.s.state === 'uploading'
        f.s.state = 'merging'
        return { data: { ...f.s, claimed } }
      }
      if (args.p_action === 'publish') {
        f.s.state = 'ready'
        f.s.asset_id = 'asset'
        return { data: f.s }
      }
      return { data: f.s }
    },
  }),
}))
import { completeUpload, prepareUpload } from '@/lib/baidu-material-upload'
const hash = '0cc175b9c0f1b6a831c399e269772661'
afterEach(() => vi.unstubAllGlobals())
function session(state: string) {
  f.s = {
    id: 's',
    user_id: 'u',
    account_id: '100',
    account_generation: 'g',
    name: 'x',
    path: '/apps/a/unique',
    size: 1,
    subject: 'math',
    mime: 'text/plain',
    hashes: [hash],
    parts: { 0: hash },
    state,
    upload_id: 'up',
  }
  f.createCount = 0
}
function provider(timeout = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      const method = url.searchParams.get('method')
      if (method === 'create') {
        f.createCount++
        expect(JSON.parse((init.body as URLSearchParams).get('block_list')!)).toEqual([hash])
        if (timeout) throw Error('timeout')
        return new Response(
          '{"errno":0,"path":"/apps/a/unique","fs_id":9223372036854775807,"size":1,"isdir":0}',
        )
      }
      if (method === 'list')
        return new Response(
          '{"errno":0,"list":[{"path":"/apps/a/unique","fs_id":9223372036854775807,"size":1,"isdir":0}]}',
        )
      if (method === 'filemetas') {
        expect(url.searchParams.get('fsids')).toBe('[9223372036854775807]')
        return new Response(
          '{"errno":0,"list":[{"fs_id":9223372036854775807,"size":1,"isdir":0,"dlink":"https://d.pcs.baidu.com/file"}]}',
        )
      }
      if (method === 'precreate') {
        expect((init.body as URLSearchParams).get('block_list')).toBe(JSON.stringify([hash]))
        return Response.json({ errno: 0, return_type: 1, uploadid: 'up', block_list: [] })
      }
      return new Response('a', { headers: { 'content-length': '1' } })
    }),
  )
}
it('recovers create timeout via exact metadata/full-byte hashes, without repeating create', async () => {
  session('uploading')
  provider(true)
  expect((await completeUpload('s', 'u')).state).toBe('merging')
  expect((await completeUpload('s', 'u')).state).toBe('ready')
  expect(f.createCount).toBe(1)
})
it('honestly keeps a crashed pre-create claim unconfirmed when no exact remote file exists', async () => {
  session('merging')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ errno: 0, list: [] })),
  )
  const r = await completeUpload('s', 'u')
  expect(r.state).toBe('merging')
  expect('error' in r && r.error).toContain('unconfirmed')
  expect(f.createCount).toBe(0)
})
it('precreate already-present blocks stay in full ordered manifest', async () => {
  session('initializing')
  provider()
  const p = await prepareUpload('s', 'u')
  expect(p.missingParts).toEqual([])
  expect((await completeUpload('s', 'u')).state).toBe('ready')
  expect(f.createCount).toBe(1)
})
