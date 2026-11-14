import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KET_READING_EXAMPLE, KET_READING_EXAMPLE_SET } from '../../../packages/exams/examples/ket-reading-part1'
import { KET_READING_EXAMPLE_SOLUTION } from '../../../packages/exams/examples/ket-reading-part1.solution'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), unreachable: false, isAdmin: vi.fn(), createDb: vi.fn(),
  listCatalog: vi.fn(), listDrafts: vi.fn(), readDraft: vi.fn(), saveDraft: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
  getUserFromRequest: mocks.getUser,
  lookupUserFromRequest: async (...args: unknown[]) => ({ user: await mocks.getUser(...args), unreachable: mocks.unreachable }),
  isAdminRequestUser: mocks.isAdmin,
  createAdminSupabase: mocks.createDb,
}))
vi.mock('@/lib/exams/repository', () => ({
  listExamCatalog: mocks.listCatalog,
  listExamDrafts: mocks.listDrafts,
  readExamDraft: mocks.readDraft,
  saveExamDraft: mocks.saveDraft,
}))

import { GET as catalog } from '@/app/api/exams/catalog/route'
import { GET as drafts, POST as createDraft } from '@/app/api/admin/exams/route'
import { GET as detail, PATCH as updateDraft } from '@/app/api/admin/exams/[id]/route'
import { ExamApiError } from '@/lib/exams/http'

const actorId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const version = '33333333-3333-4333-8333-333333333333'
const draft = {
  contentSet: KET_READING_EXAMPLE_SET,
  content: KET_READING_EXAMPLE,
  solutions: KET_READING_EXAMPLE_SOLUTION,
}
const context = () => Promise.resolve({ id: draft.content.id })
const request = (method: string, body: unknown) => new Request('https://rosie.test/api/admin/exams', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.unreachable = false
  mocks.getUser.mockResolvedValue({ id: actorId, app_metadata: { role: 'admin' } })
  mocks.isAdmin.mockReturnValue(true)
  mocks.createDb.mockReturnValue({})
  mocks.listCatalog.mockResolvedValue({ items: [], page: 1, pageSize: 25, hasMore: false })
  mocks.listDrafts.mockResolvedValue({ items: [], page: 1, pageSize: 25, hasMore: false })
  mocks.saveDraft.mockResolvedValue({
    id: draft.content.id, contentSetId: draft.contentSet.id, revision: 1, version, status: 'draft',
    createdAt: '2026-11-13T08:00:00Z', updatedAt: '2026-11-13T08:00:00Z',
  })
})

describe('exam API access', () => {
  it('reports an unreachable auth service separately from a missing login', async () => {
    mocks.unreachable = true
    const response = await detail(new Request('https://rosie.test/api/admin/exams/id'), { params: context() })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'auth_unavailable' })
    expect(mocks.createDb).not.toHaveBeenCalled()
    expect(mocks.readDraft).not.toHaveBeenCalled()
  })

  it('denies anonymous catalog access before creating a privileged client', async () => {
    mocks.getUser.mockResolvedValue(null)
    const response = await catalog(new Request('https://rosie.test/api/exams/catalog'))
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.createDb).not.toHaveBeenCalled()
  })

  it('denies non-admin draft reads and writes, including claimed parent PINs', async () => {
    mocks.isAdmin.mockReturnValue(false)
    const responses = [
      await drafts(new Request('https://rosie.test/api/admin/exams')),
      await detail(new Request('https://rosie.test/api/admin/exams/id'), { params: context() }),
      await createDraft(request('POST', { draft, requestId, pin: '666666' })),
      await updateDraft(request('PATCH', { draft, requestId, expectedVersion: version }), { params: context() }),
    ]
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403])
    expect(mocks.createDb).not.toHaveBeenCalled()
    expect(mocks.readDraft).not.toHaveBeenCalled()
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('uses the authenticated actor and an explicit create precondition', async () => {
    const response = await createDraft(request('POST', { draft, requestId }))
    expect(response.status).toBe(201)
    expect(mocks.saveDraft).toHaveBeenCalledWith({}, draft, {
      actorId, requestId, expectedVersion: null,
    })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('rejects client actor fields and PATCH revisions that disagree with the route', async () => {
    const forged = await createDraft(request('POST', { draft, requestId, actorId: 'someone-else' }))
    const mismatch = await updateDraft(request('PATCH', { draft, requestId, expectedVersion: version }), {
      params: Promise.resolve({ id: 'different-revision' }),
    })
    expect(forged.status).toBe(400)
    expect(mismatch.status).toBe(400)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('requires a PATCH version and preserves a storage conflict as 409', async () => {
    const missing = await updateDraft(request('PATCH', { draft, requestId }), { params: context() })
    expect(missing.status).toBe(400)
    mocks.saveDraft.mockRejectedValue(new ExamApiError('exam_conflict', 409))
    const conflict = await updateDraft(request('PATCH', { draft, requestId, expectedVersion: version }), { params: context() })
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'exam_conflict' })
  })

  it('does not turn unavailable storage into an empty catalog or expose database errors', async () => {
    mocks.listCatalog.mockRejectedValue(new Error('relation exam_content_revisions does not exist'))
    const response = await catalog(new Request('https://rosie.test/api/exams/catalog'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'exam_unavailable' })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('rejects invalid pagination and oversized request bodies before storage access', async () => {
    const badPage = await catalog(new Request('https://rosie.test/api/exams/catalog?page=NaN'))
    const tooLarge = new Request('https://rosie.test/api/admin/exams', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '2097153' }, body: '{}',
    })
    expect(badPage.status).toBe(400)
    expect((await createDraft(tooLarge)).status).toBe(413)
    expect(mocks.createDb).not.toHaveBeenCalled()
  })
})
