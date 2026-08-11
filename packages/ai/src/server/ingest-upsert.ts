import { chunkDocument } from './chunker'
import { contentHash, normalizeContent } from './content-hash'
import { embedTexts } from './embed'
import { createSupabaseAdmin } from './supabase-admin'

export interface IngestDocumentInput {
  subject: 'english' | 'math' | 'chinese'
  sourceType: 'db_sync' | 'catalog_sync' | 'import'
  sourceRef: string
  title: string
  content: string
  metadata?: Record<string, unknown>
  ownerId?: string | null
}

export interface IngestDocumentResult {
  documentId: string
  chunkCount: number
  skipped: boolean
}

export async function upsertKnowledgeDocument(
  input: IngestDocumentInput,
): Promise<IngestDocumentResult> {
  const admin = createSupabaseAdmin()
  const normalized = normalizeContent(input.content)
  const hash = contentHash(normalized)
  const now = new Date().toISOString()
  const docPayload = {
    subject: input.subject,
    source_type: input.sourceType,
    source_ref: input.sourceRef,
    owner_id: input.ownerId ?? null,
    title: input.title,
    content: normalized,
    content_hash: hash,
    metadata: input.metadata ?? {},
    updated_at: now,
  }
  const chunks = chunkDocument({
    subject: input.subject,
    title: input.title,
    content: normalized,
    metadata: { ...(input.metadata ?? {}), sourceRef: input.sourceRef },
  })

  const { data: existing, error: existingError } = await admin
    .from('knowledge_documents')
    .select('id, content_hash')
    .eq('source_ref', input.sourceRef)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing?.content_hash === hash) {
    const { count, error } = await admin
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', existing.id)
    if (error) throw error
    if ((count ?? 0) === chunks.length) {
      // Metadata and deep links can change without changing the searchable
      // content. Keep embeddings, but refresh both document and chunk metadata.
      const { error: updateError } = await admin
        .from('knowledge_documents')
        .update(docPayload)
        .eq('id', existing.id)
      if (updateError) throw updateError

      for (const chunk of chunks) {
        const { error: chunkError } = await admin
          .from('knowledge_chunks')
          .update({
            user_id: input.ownerId ?? null,
            subject: input.subject,
            metadata: chunk.metadata,
          })
          .eq('document_id', existing.id)
          .eq('chunk_index', chunk.chunkIndex)
        if (chunkError) throw chunkError
      }
      return { documentId: existing.id, chunkCount: count ?? 0, skipped: true }
    }
  }
  // Do all fallible external work before touching the current searchable data.
  const embeddings = chunks.length > 0 ? await embedTexts(chunks.map((c) => c.content)) : []
  if (embeddings.length !== chunks.length) throw new Error('embedding_count_mismatch')

  let documentId = existing?.id as string | undefined
  const isNewDocument = !documentId

  if (!documentId) {
    const { data, error } = await admin
      .from('knowledge_documents')
      .insert(docPayload)
      .select('id')
      .single()
    if (error) throw error
    documentId = data.id
  }

  if (!documentId) throw new Error('document_insert_failed')

  if (chunks.length === 0) {
    if (!isNewDocument) {
      const { error } = await admin
        .from('knowledge_documents')
        .update(docPayload)
        .eq('id', documentId)
      if (error) throw error
      const { error: deleteError } = await admin
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', documentId)
      if (deleteError) throw deleteError
    }
    return { documentId, chunkCount: 0, skipped: false }
  }

  const rows = chunks.map((chunk, index) => ({
    document_id: documentId,
    user_id: input.ownerId ?? null,
    subject: input.subject,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: embeddings[index],
    metadata: chunk.metadata,
  }))

  if (isNewDocument) {
    const { error: insertError } = await admin.from('knowledge_chunks').insert(rows)
    if (insertError) {
      await admin.from('knowledge_documents').delete().eq('id', documentId)
      throw insertError
    }
  } else {
    const { data: oldRows, error: oldRowsError } = await admin
      .from('knowledge_chunks')
      .select('id')
      .eq('document_id', documentId)
    if (oldRowsError) throw oldRowsError

    const { data: insertedRows, error: insertError } = await admin
      .from('knowledge_chunks')
      .insert(rows)
      .select('id')
    if (insertError) throw insertError

    const insertedIds = (insertedRows ?? []).map((row: { id: string }) => row.id)
    const oldIds = (oldRows ?? []).map((row: { id: string }) => row.id)
    const { error: updateError } = await admin
      .from('knowledge_documents')
      .update(docPayload)
      .eq('id', documentId)
    if (updateError) {
      if (insertedIds.length > 0)
        await admin.from('knowledge_chunks').delete().in('id', insertedIds)
      throw updateError
    }
    if (oldIds.length > 0) {
      const { error: deleteError } = await admin.from('knowledge_chunks').delete().in('id', oldIds)
      if (deleteError) throw deleteError
    }
  }

  return { documentId, chunkCount: rows.length, skipped: false }
}
