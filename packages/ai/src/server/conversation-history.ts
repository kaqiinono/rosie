import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

const HISTORY_LIMIT = 8
const MESSAGE_LIMIT = 500

interface ConversationRow {
  role: string
  content: string
}

export function normalizeConversationHistory(rows: ConversationRow[]): ChatHistoryMessage[] {
  return rows
    .filter(
      (row): row is ConversationRow & { role: ChatHistoryMessage['role'] } =>
        (row.role === 'user' || row.role === 'assistant') && Boolean(row.content.trim()),
    )
    .slice(0, HISTORY_LIMIT)
    .reverse()
    .map((row) => ({ role: row.role, content: row.content.trim().slice(0, MESSAGE_LIMIT) }))
}

export async function loadConversationHistory(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
): Promise<ChatHistoryMessage[]> {
  if (!sessionId) return []
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('role,content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return normalizeConversationHistory((data ?? []) as ConversationRow[])
}
