import { describe, expect, it } from 'vitest'
import { fallbackAgentResponse, safeParseAgentResponse } from '@rosie/ai'

describe('agent-response schema', () => {
  it('accepts navigate actions with internal href', () => {
    const parsed = safeParseAgentResponse({
      text: '你好',
      blocks: [{ type: 'text', content: '你好' }],
      actions: [{ type: 'navigate', href: '/chinese/g2a/reading/3-2', label: '读全文' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects external href', () => {
    const parsed = safeParseAgentResponse({
      text: 'bad',
      blocks: [{ type: 'text', content: 'bad' }],
      actions: [{ type: 'navigate', href: 'https://evil.com', label: 'bad' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('fallback produces valid response', () => {
    const data = fallbackAgentResponse('测试')
    expect(data.blocks[0]?.type).toBe('text')
  })

  it('accepts reusable subject-card blocks', () => {
    for (const block of [
      {
        type: 'word_card',
        sourceRef: 'word_entries:apple',
        word: 'apple',
        chineseDef: '苹果',
        syllables: ['ap', 'ple'],
        vocabType: 'Target',
      },
      {
        type: 'char_card',
        sourceRef: 'chinese_char_entries:水',
        char: '水',
        pinyin: 'shuǐ',
        phrases: ['水果'],
        radical: '水',
        strokeCount: 4,
      },
      {
        type: 'math_problem',
        sourceRef: 'math:problem:2-4-L1',
        problemId: '2-4-L1',
        title: '甲乙和差',
      },
      {
        type: 'poem_recite',
        sourceRef: 'chinese:poem:g1b:jing-ye-si',
        bookSlug: 'g1b',
        poemId: 'jing-ye-si',
        title: '静夜思',
      },
      {
        type: 'passage_excerpt',
        sourceRef: 'english:reading:4A:Unit 5:Lesson 1',
        title: 'Letters to HelpMe Hal',
        subject: 'english',
        passageKey: '4a-u5l1',
        stage: '4A',
        unit: 'Unit 5',
        lesson: 'Lesson 1',
        paragraphs: ['Dear HelpMe Hal,'],
      },
      {
        type: 'learning_status',
        subject: 'math',
        view: 'mistakes',
      },
      {
        type: 'today_tasks',
        subject: 'english',
      },
    ]) {
      expect(
        safeParseAgentResponse({ text: '展示卡片', blocks: [block], actions: [] }).success,
      ).toBe(true)
    }
  })
})
