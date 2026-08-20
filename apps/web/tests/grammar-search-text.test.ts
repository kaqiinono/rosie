import { describe, it, expect } from 'vitest'
import { buildGrammarSearchText } from '../../../scripts/grammar-search-text.mjs'

const row = {
  title: 'Present continuous (I am doing)',
  title_zh: '现在进行时',
  category: 'present_continuous',
  category_zh: '现在进行时',
  lesson: {
    sections: [
      {
        title: '规则',
        blocks: [
          { type: 'rule_text', text: '用 am/is/are + 动词-ing 表示正在发生的事。' },
          {
            type: 'examples',
            items: [{ en: 'She is reading a book.', zh: '她正在看书。' }],
          },
          {
            type: 'grammar_table',
            title: '结构表',
            headers: ['主语', 'be'],
            rows: [['I', 'am']],
          },
        ],
      },
    ],
  },
  exercises: [
    {
      section: '1.1',
      instruction: '填空',
      items: [{ question: 'She ___ reading.', answer: 'is' }],
    },
  ],
}

describe('buildGrammarSearchText', () => {
  it('includes title, zh title, category zh', () => {
    const text = buildGrammarSearchText(row)
    expect(text).toContain('Present continuous')
    expect(text).toContain('现在进行时')
  })

  it('flattens rule_text, examples and grammar_table', () => {
    const text = buildGrammarSearchText(row)
    expect(text).toContain('用 am/is/are + 动词-ing 表示正在发生的事。')
    expect(text).toContain('She is reading a book.')
    expect(text).toContain('她正在看书。')
    expect(text).toContain('表: 结构表')
    expect(text).toContain('I | am')
  })

  it('never includes exercise answers', () => {
    const text = buildGrammarSearchText(row)
    expect(text).not.toContain('填空')
    expect(text).not.toContain('She ___ reading.')
  })

  it('falls back to metadata only when lesson is missing', () => {
    const text = buildGrammarSearchText({ title: 'T', title_zh: '中', category_zh: '类' })
    expect(text).toBe('T\n中\n类')
  })
})
