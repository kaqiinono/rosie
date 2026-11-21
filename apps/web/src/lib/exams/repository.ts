import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { validateExamDraft, type ExamDraftInput } from '@rosie/exams/validation'
import type { ExamAdminListItem, ExamCatalogItem, ExamDraftListItem, ExamDraftReceipt, ExamDraftRecord, ExamPage } from './contracts'
import { ExamApiError, type ExamPageRequest } from './http'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CATALOG_COLUMNS = 'id,content_set_id,revision,status,set_snapshot'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExamApiError('exam_unavailable', 503)
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ExamApiError('exam_unavailable', 503)
  return value
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new ExamApiError('exam_unavailable', 503)
  return value
}

function version(value: unknown): string {
  const result = string(value)
  if (!UUID.test(result)) throw new ExamApiError('exam_unavailable', 503)
  return result
}

function storageFailure(error: { code?: string; message?: string }): never {
  const statuses: Record<string, number> = {
    exam_invalid_draft: 400, exam_not_found: 404, exam_conflict: 409, exam_not_editable: 409, exam_invalid_media_binding: 409,
  }
  if (error.message && Object.hasOwn(statuses, error.message)) {
    throw new ExamApiError(error.message, statuses[error.message])
  }
  if (error.code === '23505') throw new ExamApiError('exam_conflict', 409)
  throw new ExamApiError('exam_unavailable', 503)
}

/** Explicit projection: never return the stored JSON document or a spread of a DB row. */
export function projectExamCatalogItem(value: unknown): ExamCatalogItem {
  const row = object(value)
  const set = object(row.set_snapshot)
  const source = object(set.source)
  const template = object(set.template)
  const kind = set.kind
  const purpose = set.purpose
  if ((kind !== 'official_paper' && kind !== 'mock_paper' && kind !== 'training_unit') ||
      (purpose !== 'training' && purpose !== 'reserved')) {
    throw new ExamApiError('exam_unavailable', 503)
  }
  if (set.id !== row.content_set_id) throw new ExamApiError('exam_unavailable', 503)
  return {
    contentSetId: string(row.content_set_id),
    revisionId: string(row.id),
    revision: positiveInteger(row.revision),
    title: string(set.title),
    source: { id: string(source.id), title: string(source.title) },
    kind,
    template: { id: string(template.id), version: positiveInteger(template.version) },
    purpose,
  }
}

async function listRows(db: SupabaseClient, page: ExamPageRequest, status: 'draft' | 'published' | 'withdrawn' | 'editable', admin = false) {
  const start = (page.page - 1) * page.pageSize
  const columns = status === 'draft' || admin ? `${CATALOG_COLUMNS},version,created_at,updated_at` : CATALOG_COLUMNS
  const query = db.from('exam_content_revisions').select(columns)
  if (status === 'editable') query.in('status', ['draft', 'published']).order('status', { ascending: false })
  else query.eq('status', status)
  if (status === 'withdrawn') query.is('superseded_by', null)
  const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: true })
    .range(start, start + page.pageSize)
  if (error) storageFailure(error)
  if (!Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
  const rows = data.map((row: unknown) => {
    const result = object(row)
    if (status === 'editable' ? result.status !== 'draft' && result.status !== 'published' : result.status !== status) throw new ExamApiError('exam_unavailable', 503)
    return result
  })
  return { rows: rows.slice(0, page.pageSize), hasMore: rows.length > page.pageSize }
}

export async function followSupersededExamRevision(db: SupabaseClient, id: string): Promise<string> {
  const { data: revision, error } = await db.from('exam_content_revisions')
    .select('content_set_id,superseded_by').eq('id', id).maybeSingle()
  if (error) storageFailure(error)
  if (!revision?.superseded_by) return id
  const { data: current, error: currentError } = await db.from('exam_content_revisions')
    .select('id').eq('content_set_id', revision.content_set_id).eq('status', 'published').maybeSingle()
  if (currentError) storageFailure(currentError)
  return current?.id ?? id
}

export async function listExamCatalog(db: SupabaseClient, page: ExamPageRequest): Promise<ExamPage<ExamCatalogItem>> {
  const result = await listRows(db, page, 'published')
  return { items: result.rows.map(projectExamCatalogItem), ...page, hasMore: result.hasMore }
}

export async function listAdminExamRevisions(db: SupabaseClient, page: ExamPageRequest, status: ExamAdminListItem['status']): Promise<ExamPage<ExamAdminListItem>> {
  const result = await listRows(db, page, status, true)
  return { items: result.rows.map(row => ({ ...projectExamCatalogItem(row), status,
    version: version(row.version), createdAt: string(row.created_at), updatedAt: string(row.updated_at) })),
    ...page, hasMore: result.hasMore }
}

export async function listExamDrafts(db: SupabaseClient, page: ExamPageRequest): Promise<ExamPage<ExamDraftListItem>> {
  const result = await listRows(db, page, 'draft')
  const items = result.rows.map((row): ExamDraftListItem => ({
    ...projectExamCatalogItem(row), version: version(row.version), status: 'draft',
    createdAt: string(row.created_at), updatedAt: string(row.updated_at),
  }))
  return { items, ...page, hasMore: result.hasMore }
}

export async function listExamMediaRevisions(db: SupabaseClient, page: ExamPageRequest) {
  const result = await listRows(db, page, 'editable', true)
  const items: ExamAdminListItem[] = result.rows.map(row => ({ ...projectExamCatalogItem(row),
    status: row.status === 'published' ? 'published' : 'draft', version: version(row.version),
    createdAt: string(row.created_at), updatedAt: string(row.updated_at) }))
  return { items, ...page, hasMore: result.hasMore }
}

export async function readExamDraft(db: SupabaseClient, id: string, live = false): Promise<ExamDraftRecord> {
  const { data, error } = await db.rpc(live ? 'read_exam_editable_revision' : 'read_exam_draft', { p_id: id })
  if (error) storageFailure(error)
  if (data === null) throw new ExamApiError('exam_not_found', 404)
  const row = object(data)
  const status = live ? row.status : 'draft'
  if (status !== 'draft' && status !== 'published' && status !== 'withdrawn') throw new ExamApiError('exam_unavailable', 503)
  const result = validateExamDraft(row.draft)
  if (!result.ok || result.value.content.id !== id) throw new ExamApiError('exam_unavailable', 503)
  return {
    draft: result.value, status, supersededBy: live && row.supersededBy !== null ? string(row.supersededBy) : null, version: version(row.version),
    createdAt: string(row.createdAt), updatedAt: string(row.updatedAt),
  }
}

async function verifyVocabularyReferences(db: SupabaseClient, draft: ExamDraftInput) {
  const links = draft.content.vocabularyLinks
  const ids = [...new Set(links.map((link) => link.wordEntryId.toLowerCase()))]
  const entries = new Map<string, Record<string, unknown>>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await db.from('word_entries').select('id,stage,unit,lesson,word').in('id', ids.slice(offset, offset + 100))
    if (error) storageFailure(error)
    if (!Array.isArray(data)) throw new ExamApiError('exam_unavailable', 503)
    for (const value of data as unknown[]) {
      const row = object(value)
      entries.set(string(row.id).toLowerCase(), row)
    }
  }
  for (const link of links) {
    const row = entries.get(link.wordEntryId.toLowerCase())
    const snapshot = link.sourceSnapshot
    if (!row || row.stage !== snapshot.stage || row.unit !== snapshot.unit ||
        row.lesson !== snapshot.lesson || row.word !== snapshot.word) {
      throw new ExamApiError('exam_invalid_vocabulary_reference', 422)
    }
  }
}

export async function saveExamDraft(
  db: SupabaseClient,
  draft: ExamDraftInput,
  command: { actorId: string; requestId: string; expectedVersion: string | null; live?: boolean },
): Promise<ExamDraftReceipt> {
  await verifyVocabularyReferences(db, draft)
  const { data, error } = await db.rpc(command.live && command.expectedVersion !== null ? 'save_exam_edited_revision' : 'save_exam_draft', {
    p_actor: command.actorId,
    p_request_id: command.requestId,
    p_expected_version: command.expectedVersion,
    p_set: draft.contentSet,
    p_content: draft.content,
    p_solutions: draft.solutions,
  })
  if (error) storageFailure(error)
  const row = object(data)
  if (row.contentSetId !== draft.contentSet.id || (
    row.status === 'published'
      ? !command.live || command.expectedVersion === null || row.id === draft.content.id || positiveInteger(row.revision) <= draft.content.revision
      : row.status !== 'draft' || row.id !== draft.content.id || row.revision !== draft.content.revision
  )) {
    throw new ExamApiError('exam_unavailable', 503)
  }
  return {
    id: string(row.id), contentSetId: string(row.contentSetId), revision: positiveInteger(row.revision),
    version: version(row.version), status: row.status === 'published' ? 'published' : 'draft',
    createdAt: string(row.createdAt), updatedAt: string(row.updatedAt),
  }
}
