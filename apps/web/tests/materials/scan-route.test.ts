import { it, expect, vi, beforeEach } from 'vitest'
const f = vi.hoisted(() => ({ user: null as { id: string } | null, scan: vi.fn() }))
vi.mock('@/lib/api-auth', () => ({
  getUserFromRequest: async () => f.user,
  unauthorizedResponse: () => new Response('{}', { status: 401 }),
}))
vi.mock('@/lib/baidu-material-catalog', () => ({
  materialRoots: { english: '/airosie/english' },
  scanMaterialDirectory: f.scan,
}))
import { POST } from '@/app/api/materials/baidu/scan/route'
beforeEach(() => {
  f.user = null
  f.scan.mockReset()
})
it('authenticates before scanning and derives owner from verified auth', async () => {
  const req = () =>
    new Request('http://localhost/api/materials/baidu/scan', {
      method: 'POST',
      body: JSON.stringify({
        rootId: 'english',
        relativePath: '5A',
        recursive: true,
        subject: 'english',
        userId: 'foreign',
        account_id: 'forged',
      }),
    })
  expect((await POST(req())).status).toBe(401)
  expect(f.scan).not.toHaveBeenCalled()
  f.user = { id: 'owner' }
  f.scan.mockResolvedValue({
    sessionId: 'fixture',
    files: [],
    folders: [],
    cursor: '0',
    complete: false,
  })
  const result = await POST(req())
  expect(result.status).toBe(200)
  expect(f.scan.mock.calls[0][1]).toBe('owner')
  expect(result.headers.get('cache-control')).toBe('no-store')
})
it('returns no provider secrets on incomplete/error', async () => {
  f.user = { id: 'owner' }
  f.scan.mockRejectedValue(Error('access_token=secret'))
  const response = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }))
  expect(response.status).toBe(409)
  expect(await response.text()).not.toContain('secret')
})
