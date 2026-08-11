import { createSupabaseAdmin } from './supabase-admin'

export type KnowledgeSyncStatus = 'running' | 'partial' | 'completed' | 'failed'

export interface KnowledgeSyncProgress {
  sourceKey: string
  status: KnowledgeSyncStatus
  recordsSynced?: number
  chunksCreated?: number
  chunksDeleted?: number
  cursorPosition?: number
  totalRecords?: number | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}

export async function updateKnowledgeSyncState(progress: KnowledgeSyncProgress): Promise<void> {
  const admin = createSupabaseAdmin()
  const now = new Date().toISOString()
  const terminal = progress.status === 'completed' || progress.status === 'failed'
  const payload = {
    source_key: progress.sourceKey,
    status: progress.status,
    records_synced: progress.recordsSynced ?? 0,
    chunks_created: progress.chunksCreated ?? 0,
    chunks_deleted: progress.chunksDeleted ?? 0,
    cursor_position: progress.cursorPosition ?? 0,
    total_records: progress.totalRecords ?? null,
    error_msg: progress.errorMessage ?? null,
    metadata: progress.metadata ?? {},
    started_at: progress.status === 'running' ? now : undefined,
    completed_at: terminal ? now : null,
    last_synced_at: progress.status === 'completed' ? now : null,
    updated_at: now,
  }

  const { error } = await admin
    .from('knowledge_sync_state')
    .upsert(payload, { onConflict: 'source_key' })
  if (error) throw error
}
