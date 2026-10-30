import { it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
const f = vi.hoisted(() => ({
  auth: vi.fn(async (req: Request) =>
    req.headers.get('authorization') === 'Bearer cookie-token' ? { id: 'u' } : null,
  ),
  open: vi.fn(async () => new Response('abcdef', { headers: { 'content-length': '6' } })),
}))
vi.mock('@/lib/api-auth', () => ({
  getUserFromRequest: f.auth,
  getBearerToken: () => null,
  createAuthedSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              source: 'baidu',
              status: 'ready',
              account_id: '100',
              fs_id: '9007199254740993',
              size: 6,
              title: 'x',
              mime_type: 'image/png',
            },
          }),
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/baidu-token', () => ({
  getBaiduAccountContext: async () => ({
    accountId: '100',
    generation: 'g',
    accessToken: 'secret',
  }),
}))
vi.mock('@/lib/baidu-material-delivery', async (original) => ({
  ...(await original<typeof import('@/lib/baidu-material-delivery')>()),
  openProviderFile: f.open,
}))
import { GET } from '@/app/api/materials/[id]/content/route'
it('media tags can authenticate using scoped HttpOnly cookie, bearer absent; unauthenticated fails before provider', async () => {
  expect(
    (
      await GET(new NextRequest('https://rosie.test/api/materials/a/content'), {
        params: Promise.resolve({ id: 'a' }),
      })
    ).status,
  ).toBe(401)
  expect(f.open).not.toHaveBeenCalled()
  const r = await GET(
    new NextRequest('https://rosie.test/api/materials/a/content', {
      headers: { cookie: 'rosie_material_session=cookie-token' },
    }),
    { params: Promise.resolve({ id: 'a' }) },
  )
  expect(r.status).toBe(200)
  expect(await r.text()).toBe('abcdef')
  expect(r.headers.get('Cache-Control')).toBe('private, no-store')
  expect(r.headers.has('Location')).toBe(false)
})
