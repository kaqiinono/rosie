import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@rosie/core', () => ({
  STORAGE_KEYS: {
    AI_CONVERSATION_ID: 'ai-conversation-id-v1',
    AI_TEACHING_SESSION_ID: 'ai-teaching-session-id-v1',
  },
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-access-token' } },
      })),
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { AiChatPanel } from '@rosie/ai'

function sseResponse(events: Array<{ event: string; data: unknown }>): Response {
  const body = events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('AiChatPanel teaching flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('restores an active teaching session in the current browser tab', async () => {
    sessionStorage.setItem('ai-conversation-id-v1', '00000000-0000-4000-8000-000000000001')
    sessionStorage.setItem('ai-teaching-session-id-v1', '00000000-0000-4000-8000-000000000002')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        session: {
          id: '00000000-0000-4000-8000-000000000002',
          conversationId: '00000000-0000-4000-8000-000000000001',
          subject: 'math',
          teachingStage: 'hint',
          hintLevel: 2,
          attemptCount: 1,
          state: {},
          status: 'active',
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-11T00:01:00.000Z',
        },
      }),
    )

    render(<AiChatPanel />)

    expect(await screen.findByText('当前阶段：逐步提示')).toBeInTheDocument()
    expect(screen.getByText('已尝试 1 次 · 提示 2/3')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/ai/teaching-sessions?id=')
  })

  it('starts an explicit teaching session after a subject answer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { event: 'token', data: { text: '我们一步一步想。' } },
        {
          event: 'envelope',
          data: {
            text: '我们一步一步想。',
            blocks: [{ type: 'text', content: '我们一步一步想。' }],
            actions: [],
            sources: [{ sourceRef: 'math:problem:35-L1', title: '题目', subject: 'math' }],
          },
        },
        {
          event: 'done',
          data: {
            conversationId: '00000000-0000-4000-8000-000000000001',
            messageId: 'message-1',
          },
        },
      ]),
    )
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          session: {
            id: '00000000-0000-4000-8000-000000000002',
            conversationId: '00000000-0000-4000-8000-000000000001',
            subject: 'math',
            contentRef: 'math:problem:35-L1',
            teachingStage: 'understand',
            hintLevel: 0,
            attemptCount: 0,
            state: {},
            status: 'active',
            createdAt: '2026-08-11T00:00:00.000Z',
            updatedAt: '2026-08-11T00:00:00.000Z',
          },
        },
        { status: 201 },
      ),
    )

    render(<AiChatPanel />)
    fireEvent.click(screen.getByRole('button', { name: '打字员那道题怎么做？' }))

    const start = await screen.findByRole('button', { name: '开始引导学习' })
    fireEvent.click(start)

    expect(await screen.findByText('当前阶段：理解题意')).toBeInTheDocument()
    expect(screen.getByText('已尝试 0 次 · 提示 0/3')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/ai/teaching-sessions')
  })
})
