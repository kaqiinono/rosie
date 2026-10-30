import { describe, it, expect, vi } from 'vitest'
import { GET } from '../../src/app/api/materials/[id]/access/route'
const fixture = vi.hoisted(() => ({
  user: true,
  asset: null as null | { status: string; kind: string; text_content?: string; href?: string },
}))
vi.mock('../../src/lib/api-auth', () => ({
  getUserFromRequest: async () => (fixture.user ? { id: 'u' } : null),
  getBearerToken: () => (fixture.user ? 'fixture' : null),
  createAuthedSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: fixture.asset, error: null }) }),
      }),
    }),
  }),
}))
const get = (query = '') =>
  GET(new Request(`https://rosie.test/api/materials/id/access${query}`), {
    params: Promise.resolve({ id: 'id' }),
  })
describe('authenticated material delivery', () => {
  it('rejects unauthenticated and missing assets', async () => {
    fixture.user = false
    expect((await get()).status).toBe(401)
    fixture.user = true
    fixture.asset = null
    expect((await get()).status).toBe(404)
  })
  it('downloads archived text with private no-store headers', async () => {
    fixture.asset = { status: 'archived', kind: 'text', text_content: 'retained notes' }
    const response = await get('?download=1')
    expect(await response.text()).toBe('retained notes')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toContain('attachment')
  })
  it('returns validated links but never fabricates unavailable file transport', async () => {
    fixture.asset = { status: 'ready', kind: 'link', href: 'https://site.test/lesson' }
    expect(await (await get()).json()).toEqual({ url: 'https://site.test/lesson' })
    fixture.asset = { status: 'ready', kind: 'file' }
    expect((await get()).status).toBe(409)
    fixture.asset = { status: 'ready', kind: 'link', href: 'https://u:secret@site.test' }
    expect((await get()).status).toBe(409)
  })
})
