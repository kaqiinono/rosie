import type { SupabaseClient, User } from '@supabase/supabase-js'
import { runAgentOrchestrator } from '../agent/orchestrator'
import type { AgentResponse, ChatContext, LessonNote, SimilarProblem, TeachingSessionState } from '../types'
import { buildChatSystemPrompt, buildChatUserPrompt } from './prompts'
import { streamChatTokens } from './chat-stream'
import { loadStudentProfile } from './student-profile'
import { shouldHideFullSolution } from './teaching-session'
import { getTeachingSession } from './teaching-session-store'
import { loadConversationHistory } from './conversation-history'

export type { LessonNote, SimilarProblem }

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
  lessonNotes?: LessonNote[]
  similarProblem?: SimilarProblem
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
        lessonNotes: input.lessonNotes,
        similarProblem: input.similarProblem,
        history,
      }),
      loadStudentProfile(input.supabase, input.user.id).catch(() => null),
    ])
    const teachingSession = input.teachingSessionId
      ? await getTeachingSession(input.supabase, input.user.id, input.teachingSessionId)
      : null
    let llmText = envelope.text

    // For review / similar-problem intents, the orchestrator already produced the
    // full formatted answer. Skip LLM rephrasing to avoid overwriting the notes/problem.
    const isDirectEnrichment =
      envelope.blocks.some((block) => block.type === 'passage_excerpt') ||
      (input.context?.subject === 'math' &&
        ((input.lessonNotes?.length &&
          (input.message.includes('复习') || input.message.includes('重点') ||
           input.message.includes('讲次') || input.message.includes('笔记') ||
           input.message.includes('易错点'))) ||
         (input.similarProblem &&
          (input.message.includes('相似') || input.message.includes('类似') ||
           input.message.includes('例题') || input.message.includes('讲解完整过程')))))

    if (isDirectEnrichment) {
      // Stream the orchestrator's text directly as tokens (no LLM rewrite)
      const text = envelope.text
      yield sseLine({ event: 'token', data: { text } })
    } else {
    try {
      const stream = streamChatTokens(
        buildChatSystemPrompt(Boolean(profile)),
        buildChatUserPrompt(
          input.message,
          envelope,
          profile,
          teachingSession,
          history,
          input.context,
          input.lessonNotes,
        ),
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
    } // end else (non-direct-enrichment path)

    if (teachingSession && shouldHideFullSolution(teachingSession)) {
      envelope.blocks = envelope.blocks.filter((block) => block.type !== 'math_solution')
    } else if (input.context?.activeContent?.hasAttempted !== true) {
      envelope.blocks = envelope.blocks.filter(
        (block) =>
          block.type !== 'math_solution' ||
          block.problemId !== input.context?.activeContent?.problemId,
      )
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
