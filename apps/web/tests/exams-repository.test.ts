import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamDraftInput } from '@rosie/exams/validation'
import { listExamCatalog, projectExamCatalogItem, readExamDraft, saveExamDraft } from '@/lib/exams/repository'
import { KET_READING_EXAMPLE, KET_READING_EXAMPLE_SET } from '../../../packages/exams/examples/ket-reading-part1'
import { KET_READING_EXAMPLE_SOLUTION } from '../../../packages/exams/examples/ket-reading-part1.solution'

const publishedRow = {
  id: 'example:revision-1', content_set_id: KET_READING_EXAMPLE_SET.id, revision: 1, status: 'published',
  set_snapshot: { ...KET_READING_EXAMPLE_SET, extra: 'PRIVATE_SOURCE_PATH' },
  content: { secret: 'PRIVATE_MATERIAL' }, solutions: { secret: 'PRIVATE_ANSWER' },
}

function client(rows: unknown[]) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), in: vi.fn() }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockResolvedValue({ data: rows, error: null })
  query.in.mockResolvedValue({ data: rows, error: null })
  const db = { from: vi.fn().mockReturnValue(query), rpc: vi.fn() }
  return { db, query, connection: db as unknown as SupabaseClient }
}

describe('exam storage projection and commands', () => {
  it('projects only catalog metadata, including for a reserved paper', () => {
    const result = projectExamCatalogItem({
      ...publishedRow, set_snapshot: { ...publishedRow.set_snapshot, purpose: 'reserved' },
    })
    expect(result.purpose).toBe('reserved')
    expect(Object.keys(result).sort()).toEqual([
      'contentSetId', 'kind', 'purpose', 'revision', 'revisionId', 'source', 'template', 'title',
    ])
    expect(JSON.stringify(result)).not.toContain('PRIVATE_')
  })

  it('queries only published metadata, bounds paging and does not return the extra row', async () => {
    const { connection, query, db } = client([publishedRow, { ...publishedRow, id: 'example:revision-2' }])
    const result = await listExamCatalog(connection, { page: 1, pageSize: 1 })
    expect(db.from).toHaveBeenCalledWith('exam_content_revisions')
    expect(query.eq).toHaveBeenCalledWith('status', 'published')
    expect(query.select).toHaveBeenCalledWith('id,content_set_id,revision,status,set_snapshot')
    expect(query.range).toHaveBeenCalledWith(0, 1)
    expect(result.items).toHaveLength(1)
    expect(result.hasMore).toBe(true)
    expect(JSON.stringify(result)).not.toContain('PRIVATE_')
  })

  it('fails closed if a draft row reaches the catalog projection query', async () => {
    const { connection } = client([{ ...publishedRow, status: 'draft' }])
    await expect(listExamCatalog(connection, { page: 1, pageSize: 25 })).rejects.toMatchObject({ status: 503 })
  })

  it('maps a missing private draft to 404 without returning its raw RPC error', async () => {
    const { connection, db } = client([])
    db.rpc.mockResolvedValue({ data: null, error: { message: 'exam_not_found' } })
    await expect(readExamDraft(connection, 'missing')).rejects.toMatchObject({ code: 'exam_not_found', status: 404 })
  })

  it.each(['missing', 'changed'])('refuses a %s canonical vocabulary entry before saving either document', async (state) => {
    const wordEntryId = '44444444-4444-4444-8444-444444444444'
    const sourceSnapshot = { stage: '5A', unit: 'U1', lesson: 'L1', word: 'bag' }
    const block = KET_READING_EXAMPLE.materials[0].blocks[0]
    const start = block.text.indexOf('bag')
    const rows = state === 'missing' ? [] : [{ id: wordEntryId, ...sourceSnapshot, lesson: 'L2' }]
    const { connection, db } = client(rows)
    const draft: ExamDraftInput = {
      contentSet: KET_READING_EXAMPLE_SET,
      content: {
        ...KET_READING_EXAMPLE,
        vocabularyLinks: [{
          id: 'example:vocabulary-bag', wordEntryId, sourceSnapshot,
          questionIds: [KET_READING_EXAMPLE.groups[0].questions[0].id],
          materialId: KET_READING_EXAMPLE.materials[0].id,
          blockId: block.id,
          matchedForm: 'bag', contextMeaning: '包', sentence: block.text,
          textRange: { start, end: start + 3 }, role: 'key', review: { status: 'pending' },
        }],
      },
      solutions: KET_READING_EXAMPLE_SOLUTION,
    }
    await expect(saveExamDraft(connection, draft, {
      actorId: '11111111-1111-4111-8111-111111111111',
      requestId: '22222222-2222-4222-8222-222222222222', expectedVersion: null,
    })).rejects.toMatchObject({ code: 'exam_invalid_vocabulary_reference', status: 422 })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('sends content and private solutions in one CAS RPC with the verified actor', async () => {
    const { connection, db } = client([])
    const receipt = {
      id: KET_READING_EXAMPLE.id, contentSetId: KET_READING_EXAMPLE_SET.id, revision: 1,
      version: '33333333-3333-4333-8333-333333333333', status: 'draft',
      createdAt: '2026-11-13T08:00:00Z', updatedAt: '2026-11-13T08:00:00Z',
    }
    db.rpc.mockResolvedValue({ data: receipt, error: null })
    const draft = { contentSet: KET_READING_EXAMPLE_SET, content: KET_READING_EXAMPLE, solutions: KET_READING_EXAMPLE_SOLUTION }
    const command = { actorId: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222', expectedVersion: null }
    expect(await saveExamDraft(connection, draft, command)).toEqual(receipt)
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('save_exam_draft', {
      p_actor: command.actorId, p_request_id: command.requestId, p_expected_version: null,
      p_set: draft.contentSet, p_content: draft.content, p_solutions: draft.solutions,
    })
    expect(db.from).not.toHaveBeenCalled()
  })
})
