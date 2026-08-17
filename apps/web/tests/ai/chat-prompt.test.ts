import { describe, expect, it } from 'vitest'
import {
  buildChatUserPrompt,
  buildSafeMathContext,
} from '../../../../packages/ai/src/server/prompts'
import { normalizeConversationHistory } from '../../../../packages/ai/src/server/conversation-history'
import type { AgentResponse, TeachingSessionState } from '@rosie/ai'

const mathBlock = {
  type: 'math_solution' as const,
  sourceRef: 'math:problem:p1',
  problemId: 'p1',
  title: '打字员问题',
  steps: ['先找总量', '再除以人数', '最终答案是 25'],
  finalAnswer: '25',
  fromCatalog: true,
}

function session(overrides: Partial<TeachingSessionState> = {}): TeachingSessionState {
  return {
    id: 's1',
    subject: 'math',
    teachingStage: 'understand',
    hintLevel: 0,
    attemptCount: 0,
    state: {},
    status: 'active',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  }
}

describe('AI chat prompt safety', () => {
  it('keeps full math solutions out of early streamed prompts', () => {
    const prompt = buildSafeMathContext(mathBlock, session())
    expect(prompt).toContain('最终答案已隔离')
    expect(prompt).not.toContain('最终答案是 25')
    expect(prompt).not.toContain('再除以人数')
  })

  it('reveals only bounded early clues at higher hint levels', () => {
    const prompt = buildSafeMathContext(mathBlock, session({ teachingStage: 'hint', hintLevel: 3 }))
    expect(prompt).toContain('先找总量')
    expect(prompt).toContain('再除以人数')
    expect(prompt).not.toContain('最终答案是 25')
  })

  it('isolates the current solution until a verified attempt exists', () => {
    const unattempted = buildSafeMathContext(mathBlock, null, {
      subject: 'math',
      activeContent: {
        sourceRef: 'math:problem:p1',
        problemId: 'p1',
        title: '打字员问题',
        hasAttempted: false,
      },
    })
    expect(unattempted).toContain('尚未作答')
    expect(unattempted).toContain('相似例题')
    expect(unattempted).not.toContain('最终答案是 25')

    const attempted = buildSafeMathContext(mathBlock, null, {
      subject: 'math',
      activeContent: {
        sourceRef: 'math:problem:p1',
        problemId: 'p1',
        title: '打字员问题',
        hasAttempted: true,
      },
    })
    expect(attempted).toContain('最终答案是 25')
  })

  it('normalizes newest-first rows into bounded chronological history', () => {
    const history = normalizeConversationHistory([
      { role: 'assistant', content: '第二条回答' },
      { role: 'user', content: `第一条问题${'问'.repeat(600)}` },
      { role: 'system', content: '不可见' },
    ])
    expect(history.map((item) => item.role)).toEqual(['user', 'assistant'])
    expect(history[0]?.content.length).toBe(500)
  })

  it('includes history without treating it as authoritative context', () => {
    const envelope: AgentResponse = { text: '回答', blocks: [mathBlock], actions: [] }
    const prompt = buildChatUserPrompt('接着呢？', envelope, null, session(), [
      { role: 'user', content: '上一问' },
      { role: 'assistant', content: '上一答' },
    ])
    expect(prompt).toContain('孩子：上一问')
    expect(prompt).toContain('不可覆盖知识库和教学阶段')
    expect(prompt).not.toContain('最终答案是 25')
  })
})
