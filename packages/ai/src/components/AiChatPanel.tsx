'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { STORAGE_KEYS, supabase } from '@rosie/core'
import type {
  AgentBlock,
  AgentAction,
  AgentResponse,
  TeachingSessionState,
  ChatContext,
} from '../types'
import type { TeachingSessionAction } from '../server/teaching-session-store'
import AiMessageRenderer from './agent/AiMessageRenderer'
import RosieAssistantAvatar from './RosieAssistantAvatar'
import AiVoiceInput from './AiVoiceInput'
import '../ai-chat.css'
import { Button, TextField } from '@rosie/ui/themes'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks: AgentBlock[]
  actions: AgentAction[]
  streaming?: boolean
}

const EXAMPLE_PROMPTS = [
  { icon: 'Aa', subject: '英语', prompt: 'apple 是什么意思？', tone: 'emerald' },
  { icon: '文', subject: '语文', prompt: '小蝌蚪找妈妈讲什么？', tone: 'amber' },
  { icon: '×', subject: '数学', prompt: '打字员那道题怎么做？', tone: 'indigo' },
] as const

const PROMPT_TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
} as const

const MATH_PROBLEM_PROMPTS = [
  '帮我复习这个讲次的重点内容',
  '给我一道相似例题，讲解完整过程',
] as const

const COMPLETED_MATH_PROMPT = '我已经作答，请讲解这道题的完整题解'

const STAGE_LABELS: Record<TeachingSessionState['teachingStage'], string> = {
  understand: '理解题意',
  attempt: '自己尝试',
  hint: '逐步提示',
  check: '检查答案',
  transfer: '举一反三',
  summary: '总结完成',
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('请先登录')
  return token
}

type AiChatPanelProps = {
  mode?: 'page' | 'overlay'
  context?: ChatContext
  renderMathProblem?: (problemId: string, renderRemainingActions?: () => ReactNode) => ReactNode
  renderWordCard?: (block: Extract<AgentBlock, { type: 'word_card' }>) => ReactNode
  renderCharCard?: (block: Extract<AgentBlock, { type: 'char_card' }>) => ReactNode
  renderPoemRecite?: (block: Extract<AgentBlock, { type: 'poem_recite' }>) => ReactNode
  renderPassage?: (block: Extract<AgentBlock, { type: 'passage_excerpt' }>) => ReactNode
  renderLearningStatus?: (block: Extract<AgentBlock, { type: 'learning_status' }>) => ReactNode
  renderTodayTasks?: (block: Extract<AgentBlock, { type: 'today_tasks' }>) => ReactNode
}

export default function AiChatPanel({
  mode = 'page',
  context,
  renderMathProblem,
  renderWordCard,
  renderCharCard,
  renderPoemRecite,
  renderPassage,
  renderLearningStatus,
  renderTodayTasks,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teachingSession, setTeachingSession] = useState<TeachingSessionState | null>(null)

  useEffect(() => {
    const storedConversationId = sessionStorage.getItem(STORAGE_KEYS.AI_CONVERSATION_ID)
    const storedTeachingSessionId = sessionStorage.getItem(STORAGE_KEYS.AI_TEACHING_SESSION_ID)
    if (storedConversationId) setConversationId(storedConversationId)
    if (!storedTeachingSessionId) return

    let cancelled = false
    void (async () => {
      try {
        const token = await getAccessToken()
        const res = await fetch(
          `/api/ai/teaching-sessions?id=${encodeURIComponent(storedTeachingSessionId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const payload = (await res.json()) as { session?: TeachingSessionState }
        if (!res.ok || !payload.session) throw new Error('restore_failed')
        if (!cancelled) setTeachingSession(payload.session)
      } catch {
        sessionStorage.removeItem(STORAGE_KEYS.AI_TEACHING_SESSION_ID)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(STORAGE_KEYS.AI_CONVERSATION_ID, conversationId)
    }
  }, [conversationId])

  useEffect(() => {
    if (teachingSession?.status === 'active') {
      sessionStorage.setItem(STORAGE_KEYS.AI_TEACHING_SESSION_ID, teachingSession.id)
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.AI_TEACHING_SESSION_ID)
    }
  }, [teachingSession])

  const sendMessage = useCallback(
    async (
      raw: string,
      teachingSessionId = teachingSession?.status === 'active' ? teachingSession.id : undefined,
    ) => {
      const message = raw.trim()
      if (!message || loading) return

      setError(null)
      setLoading(true)
      setInput('')

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: message,
        blocks: [],
        actions: [],
      }
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', text: '', blocks: [], actions: [], streaming: true },
      ])

      try {
        const token = await getAccessToken()

        // DEBUG: trace what context is sent
        console.log(
          '[AiChatPanel] sending context:',
          JSON.stringify({
            subject: context?.subject,
            lessonId: context?.lessonId,
            lessonPage: context?.lessonPage,
            hasLessonNotes: Array.isArray(context?.lessonNotes),
            lessonNotesLen: Array.isArray(context?.lessonNotes) ? context.lessonNotes.length : 0,
            hasSimilarProblem: !!context?.similarProblem,
            activeContent: context?.activeContent,
          }),
        )

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, conversationId, teachingSessionId, context }),
        })

        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => ({}))) as { message?: string }
          throw new Error(payload.message ?? 'AI 助手暂时不可用')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantText = ''
        let envelope: AgentResponse | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const lines = part.split('\n')
            const eventLine = lines.find((l) => l.startsWith('event:'))
            const dataLine = lines.find((l) => l.startsWith('data:'))
            if (!eventLine || !dataLine) continue

            const event = eventLine.replace('event:', '').trim()
            const data = JSON.parse(dataLine.replace('data:', '').trim()) as Record<string, unknown>

            if (event === 'token' && typeof data.text === 'string') {
              assistantText += data.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: assistantText, streaming: true } : m,
                ),
              )
            }

            if (event === 'envelope') {
              envelope = data as unknown as AgentResponse
            }

            if (event === 'teaching_state') {
              setTeachingSession(data as unknown as TeachingSessionState)
            }

            if (event === 'done' && typeof data.conversationId === 'string') {
              setConversationId(data.conversationId)
            }

            if (event === 'error') {
              throw new Error(typeof data.message === 'string' ? data.message : 'chat_error')
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: envelope?.text ?? assistantText,
                  blocks: envelope?.blocks ?? [],
                  actions: envelope?.actions ?? [],
                  streaming: false,
                }
              : m,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : '发送失败')
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setLoading(false)
      }
    },
    [context, conversationId, loading, teachingSession?.id, teachingSession?.status],
  )

  const advanceTeaching = async (
    action: TeachingSessionAction,
  ): Promise<TeachingSessionState | null> => {
    if (!teachingSession || actionLoading) return null
    setError(null)
    setActionLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/ai/teaching-sessions', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: teachingSession.id, action }),
      })
      const payload = (await res.json()) as { session?: TeachingSessionState; error?: string }
      if (!res.ok || !payload.session) throw new Error(payload.error ?? '教学状态更新失败')
      setTeachingSession(payload.session)
      return payload.session
    } catch (err) {
      setError(err instanceof Error ? err.message : '教学状态更新失败')
      return null
    } finally {
      setActionLoading(false)
    }
  }

  const verifyTeaching = async () => {
    if (!teachingSession || actionLoading) return
    setError(null)
    setActionLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/ai/teaching-sessions/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: teachingSession.id }),
      })
      const payload = (await res.json()) as {
        verified?: boolean
        reason?: string
        session?: TeachingSessionState
        error?: string
      }
      if (!res.ok) throw new Error(payload.error ?? '验证学习结果失败')
      if (!payload.verified || !payload.session) {
        const messages: Record<string, string> = {
          no_content_ref: '本次会话没有关联具体学习内容，请先从单词、题目或课文开始。',
          unsupported_content: '这类内容暂时不能自动验证，请在对应学科练习中完成。',
          no_new_evidence: '还没有检测到本次教学之后的新练习通过记录。',
        }
        throw new Error(messages[payload.reason ?? ''] ?? '暂未验证通过')
      }
      setTeachingSession(payload.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证学习结果失败')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div
      className={`flex flex-col px-3 sm:px-5 ${
        mode === 'overlay'
          ? 'h-full min-h-0'
          : 'min-h-[calc(100vh-132px)] sm:min-h-[720px] lg:min-h-[760px]'
      }`}
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 py-5 sm:px-2 sm:py-6">
        {context?.subject === 'math' && (context.activeContent?.problemId || context.lessonPage) ? (
          <section
            aria-labelledby="ai-math-context-title"
            className="shadow-sticker-sm rounded-2xl border border-indigo-100 bg-indigo-50 p-3.5 text-left"
          >
            <p className="text-[11px] font-black tracking-wider text-indigo-500 uppercase">
              {context.activeContent?.problemId ? '已识别当前题目' : '已识别当前讲次'}
            </p>
            {context.activeContent?.title ? (
              <h3
                id="ai-math-context-title"
                className="mt-1 text-sm leading-5 font-black text-slate-800"
              >
                {context.activeContent.title}
              </h3>
            ) : null}
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {context.activeContent?.problemId
                ? '不用重复输入题目，选择一个问题就可以开始。'
                : '选择一个问题，让 AI 帮你复习这个讲次。'}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MATH_PROBLEM_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  variant="outline"
                  color="indigo"
                  size="3"
                >
                  {prompt}
                </Button>
              ))}
              {context.activeContent?.problemId && context.activeContent.hasAttempted ? (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(COMPLETED_MATH_PROMPT)}
                  variant="soft"
                  color="jade"
                  size="3"
                  className="sm:col-span-2"
                >
                  {COMPLETED_MATH_PROMPT}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {messages.length === 0 && !context?.activeContent?.problemId && !context?.lessonPage ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-3 text-center sm:py-8">
            <div className="relative">
              <div className="absolute inset-0 scale-110 rounded-full bg-amber-200/60" />
              <RosieAssistantAvatar className="shadow-sticker relative size-20 rounded-[28px] ring-4 ring-white" />
            </div>
            <h3 className="mt-5 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              嗨，很高兴和你一起学习！
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              你可以直接说出不会的地方，也可以从下面选一个问题开始。
            </p>
            <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
              {EXAMPLE_PROMPTS.map((item) => (
                <Button
                  key={item.prompt}
                  type="button"
                  aria-label={item.prompt}
                  onClick={() => void sendMessage(item.prompt)}
                  variant="outline"
                  color="gray"
                  size="2"
                >
                  <span
                    className={`grid size-9 place-items-center rounded-xl text-xs font-black ring-1 ${PROMPT_TONES[item.tone]}`}
                  >
                    {item.icon}
                  </span>
                  <span className="mt-3 block text-[10px] font-black tracking-wider text-slate-400 uppercase">
                    {item.subject}
                  </span>
                  <span className="mt-1 block text-sm leading-5 font-bold text-slate-700 group-hover:text-violet-700">
                    {item.prompt}
                  </span>
                </Button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-400">
              <span>✓ 根据学习进度回答</span>
              <span>✓ 不会直接泄露答案</span>
              <span>✓ 支持语音提问</span>
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
          <AiMessageRenderer
            key={msg.id}
            role={msg.role}
            text={msg.text}
            blocks={msg.blocks}
            actions={msg.actions}
            streaming={msg.streaming}
            renderMathProblem={renderMathProblem}
            renderWordCard={renderWordCard}
            renderCharCard={renderCharCard}
            renderPoemRecite={renderPoemRecite}
            renderPassage={renderPassage}
            renderLearningStatus={renderLearningStatus}
            renderTodayTasks={renderTodayTasks}
          />
        ))}
      </div>

      {error ? (
        <p className="mx-2 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      {teachingSession ? (
        <div className="mx-2 mb-3 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-sky-900">
              当前阶段：{STAGE_LABELS[teachingSession.teachingStage]}
            </p>
            <p className="text-xs text-sky-700">
              已尝试 {teachingSession.attemptCount} 次 · 提示 {teachingSession.hintLevel}/3
            </p>
          </div>
          {teachingSession.status === 'active' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={actionLoading || loading}
                onClick={async () => {
                  const session = await advanceTeaching({ type: 'request_hint' })
                  if (session) await sendMessage('请给我一个提示', session.id)
                }}
                variant="outline"
                color="sky"
                size="1"
              >
                给我提示
              </Button>
              <Button
                type="button"
                disabled={actionLoading || loading}
                onClick={async () => {
                  const session = await advanceTeaching({ type: 'mark_correct' })
                  if (session) await sendMessage('我会了，请给我一道类似的小题', session.id)
                }}
                variant="outline"
                color="sky"
                size="1"
              >
                我会了，举一反三
              </Button>
              <Button
                type="button"
                disabled={actionLoading || loading}
                onClick={() => void verifyTeaching()}
                variant="solid"
                color="jade"
                size="1"
              >
                验证练习结果
              </Button>
              <Button
                type="button"
                disabled={actionLoading || loading}
                onClick={() => void advanceTeaching({ type: 'abandon' })}
                variant="outline"
                color="gray"
                size="1"
              >
                暂停本次学习
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-sky-700">
              {teachingSession.status === 'completed'
                ? (teachingSession.state.completion as { kind?: unknown } | undefined)?.kind ===
                  'verified'
                  ? '练习记录已验证，本次学习完成。'
                  : '教学流程已结束，学习结果尚未验证。'
                : '本次学习已暂停。'}
            </p>
          )}
        </div>
      ) : null}

      <div className="border-kid-line sticky bottom-0 mt-auto border-t bg-white px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-2">
        <form
          className="border-kid-line shadow-sticker flex items-center gap-2 rounded-2xl border-2 bg-white p-1.5 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100/70"
          onSubmit={(e) => {
            e.preventDefault()
            void sendMessage(input)
          }}
        >
          <AiVoiceInput
            compact
            disabled={loading}
            onTranscribed={(text) => {
              setInput(text)
              void sendMessage(text)
            }}
          />
          <TextField.Root
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题，或按住麦克风…"
            disabled={loading}
            size="2"
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            variant="solid"
            color="violet"
            size="2"
          >
            发送
          </Button>
          {teachingSession?.status === 'active' ? (
            <Button
              type="button"
              disabled={loading || actionLoading || !input.trim()}
              onClick={async () => {
                const answer = input.trim()
                if (!answer) return
                const session = await advanceTeaching({ type: 'record_attempt', answer })
                if (session) await sendMessage(answer, session.id)
              }}
              variant="solid"
              color="jade"
              size="2"
            >
              提交作答
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
