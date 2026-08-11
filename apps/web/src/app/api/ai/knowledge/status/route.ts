import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorizedResponse()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'missing_env' }, { status: 503 })
  }

  const token =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')

  const supabase = createClient(url, anonKey, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  })

  const { count: documents, error: docError } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })

  const { count: chunks, error: chunkError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })

  const { data: syncState, error: syncStateError } = await supabase
    .from('knowledge_sync_state')
    .select(
      'source_key,status,records_synced,chunks_created,chunks_deleted,cursor_position,total_records,last_synced_at,error_msg,updated_at',
    )
    .order('source_key')

  if (docError || chunkError || syncStateError) {
    return NextResponse.json(
      {
        error:
          docError?.message ?? chunkError?.message ?? syncStateError?.message ?? 'status_error',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    documents: documents ?? 0,
    chunks: chunks ?? 0,
    syncState: syncState ?? [],
  })
}
