import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiSubject, KnowledgeSearchHit } from '../types'
import { embedText } from './embed'

export async function searchKnowledge(
  supabase: SupabaseClient,
  input: {
    query: string
    subject?: AiSubject
    grade?: number
    matchCount?: number
    metadata?: Record<string, unknown>
  },
): Promise<KnowledgeSearchHit[]> {
  const embedding = await embedText(input.query)

  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: embedding,
    query_text: input.query,
    match_subject: input.subject ?? null,
    match_grade: input.grade ?? null,
    match_metadata: input.metadata ?? null,
    match_count: input.matchCount ?? 8,
  })

  if (error) throw error

  return (data ?? []).map(
    (row: {
      chunk_id: string
      document_id: string
      subject: AiSubject
      content: string
      metadata: Record<string, unknown>
      similarity: number
    }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      subject: row.subject,
      content: row.content,
      metadata: row.metadata ?? {},
      similarity: row.similarity,
    }),
  )
}
