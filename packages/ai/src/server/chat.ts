import type { SupabaseClient, User } from '@supabase/supabase-js'
import { runAgentOrchestrator } from '../agent/orchestrator'
import type { AgentResponse, ChatContext, TeachingSessionState } from '../types'
import { buildChatSystemPrompt, buildChatUserPrompt } from './prompts'
import { streamChatTokens } from './chat-stream'
import { loadStudentProfile } from './student-profile'
import { shouldHideFullSolution } from './teaching-session'
import { getTeachingSession } from './teaching-session-store'
import { loadConversationHistory } from './conversation-history'

export type ChatStreamEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'envelope'; data: AgentResponse }
  | { event: 'teaching_state'; data: TeachingSessionState }
  | { event: 'done'; data: { conversationId: string; messageId: string } }
  | { event: 'error'; data: { message: string } }

export interface RunChatInput {
  user: User
  supabase: SupabaseClient
  message: string
  conversationId?: string
  teachingSessionId?: string
  context?: ChatContext
}

function sseLine(event: ChatStreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}

export async function* runChatStream(input: RunChatInput): AsyncGenerator<string> {
  const sessionId = input.conversationId ?? crypto.randomUUID()

  try {
    const history = await loadConversationHistory(
      input.supabase,
      input.user.id,
      input.conversationId,
    )
    await input.supabase.from('ai_conversations').insert({
      user_id: input.user.id,
      session_id: sessionId,
      role: 'user',
      content: input.message,
      blocks: [],
      actions: [],
      sources: [],
      subject: input.context?.subject ?? null,
    })

    const [envelope, profile] = await Promise.all([
      runAgentOrchestrator(input.supabase, {
        message: input.message,
        context: input.context,
      }),
      loadStudentProfile(input.supabase, input.user.id).catch(() => null),
    ])
    const teachingSession = input.teachingSessionId
      ? await getTeachingSession(input.supabase, input.user.id, input.teachingSessionId)
      : null
    let llmText = envelope.text
    try {
      const stream = streamChatTokens(
        buildChatSystemPrompt(Boolean(profile)),
        buildChatUserPrompt(input.message, envelope, profile, teachingSession, history),
      )
      let streamed = ''
      while (true) {
        const next = await stream.next()
        if (next.done) {
          llmText = next.value || streamed
          break
        }
        streamed += next.value
        yield sseLine({ event: 'token', data: { text: next.value } })
      }
      if (llmText) {
        envelope.text = llmText
        const textBlock = envelope.blocks.find((b) => b.type === 'text')
        if (textBlock?.type === 'text') textBlock.content = llmText
        else envelope.blocks.unshift({ type: 'text', content: llmText })
      }
    } catch {
      yield sseLine({ event: 'token', data: { text: envelope.text } })
    }

    if (teachingSession && shouldHideFullSolution(teachingSession)) {
      envelope.blocks = envelope.blocks.filter((block) => block.type !== 'math_solution')
    }

    const { data: inserted, error } = await input.supabase
      .from('ai_conversations')
      .insert({
        user_id: input.user.id,
        session_id: sessionId,
        role: 'assistant',
        content: envelope.text,
        blocks: envelope.blocks,
        actions: envelope.actions,
        sources: envelope.sources ?? [],
        subject: input.context?.subject ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    yield sseLine({ event: 'envelope', data: envelope })
    if (teachingSession) {
      yield sseLine({ event: 'teaching_state', data: teachingSession })
    }
    yield sseLine({
      event: 'done',
      data: { conversationId: sessionId, messageId: inserted.id },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'chat_error'
    yield sseLine({ event: 'error', data: { message } })
  }
}
