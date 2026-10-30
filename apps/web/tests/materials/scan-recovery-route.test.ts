import { beforeEach, it, expect, vi } from 'vitest'
const f = vi.hoisted(() => ({
  account: '9223372036854775806',
  generation: 'g',
  filters: [] as unknown[],
  row: null as Record<string, unknown> | null,
}))
vi.mock('@/lib/api-auth', () => ({
  getUserFromRequest: async () => ({ id: 'owner' }),
  unauthorizedResponse: () => new Response('{}', { status: 401 }),
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          f.filters.push(args)
          return {
            eq: (...args: unknown[]) => {
              f.filters.push(args)
              return { single: async () => ({ data: f.row, error: null }) }
            },
          }
        },
      }),
    }),
  }),
}))
vi.mock('@/lib/baidu-token', () => ({
  getBaiduAccountContext: async () => ({
    accountId: f.account,
    generation: f.generation,
    accessToken: 'secret',
  }),
}))
vi.mock('server-only', () => ({}))
import { GET } from '@/app/api/materials/baidu/scan/[id]/route'
const entries = Array.from({ length: 20000 }, (_, i) => ({
  account_id: '9223372036854775806',
  fs_id: String(BigInt('9223372036854700000') + BigInt(i)),
  path: `/airosie/english/5A/U3/Lesson-material-${i}.mp3`,
  name: `Lesson-material-${i}.mp3`,
  mime: 'application/octet-stream',
  size: 1024,
  isdir: false,
  asset_id: '11111111-1111-4111-8111-111111111111',
}))
beforeEach(() => {
  f.filters = []
  f.account = '9223372036854775806'
  f.row = {
    id: 'scan',
    root_id: 'english',
    path: '/airosie/english/5A',
    recursive: true,
    subject: 'english',
    revision: 18,
    account_id: f.account,
    account_generation: 'g',
    state: { queue: [], entries, complete: true },
  }
})
const get = (q = '') =>
  GET(new Request('http://localhost/api/materials/baidu/scan/scan' + q), {
    params: Promise.resolve({ id: 'scan' }),
  })
it('returns bounded recovery pages for supported 20000 entry inventories, never full durable state', async () => {
  expect(Buffer.byteLength(JSON.stringify(entries))).toBeGreaterThan(4_500_000)
  const response = await get()
  const raw = await response.text()
  const first = JSON.parse(raw)
  expect(response.status).toBe(200)
  expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(131072)
  expect(first.state).toBeUndefined()
  expect(first.fileCount).toBe(20000)
  expect(first.files.length).toBeLessThanOrEqual(100)
  expect(first.cursor).toBeNull()
  expect(first.revision).toBe(18)
  const second = await (await get('?offset=' + first.nextResultOffset + '&revision=18')).json()
  expect(second.files[0].fs_id).not.toBe(first.files[0].fs_id)
  expect(second.resultOffset).toBe(first.nextResultOffset)
  expect(f.filters).toContainEqual(['user_id', 'owner'])
})
it('rejects stale result pages and account switches while allowing latest metadata recovery', async () => {
  expect((await get('?offset=100&revision=17')).status).toBe(409)
  expect((await get()).status).toBe(200)
  f.account = 'different'
  expect((await get()).status).toBe(409)
})

it('bounds long Unicode metadata by bytes and can recover the next page', async () => {
  const long = '课'.repeat(4000)
  f.row!.path = '/airosie/english/' + '学'.repeat(1490)
  f.row!.state = {
    complete: false,
    queue: [{ path: '/airosie/english', offset: 0 }],
    entries: Array.from({ length: 100 }, (_, i) => ({
      ...entries[i],
      path: '/airosie/english/' + long + i,
      name: long + i,
    })),
  }
  const response = await get()
  const raw = await response.text(),
    first = JSON.parse(raw)
  expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(131072)
  expect(first.files.length).toBeGreaterThan(0)
  expect(first.files.length).toBeLessThan(100)
  expect(first.cursor).toBe('18')
  expect(first.complete).toBe(false)
  const second = await (await get('?offset=' + first.nextResultOffset + '&revision=18')).json()
  expect(second.resultOffset).toBe(first.files.length)
  expect(second.files[0].fs_id).not.toBe(first.files[0].fs_id)
})
