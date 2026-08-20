import { describe, it, expect } from 'vitest'
import {
  tokenizeQuery,
  searchGrammarEntries,
  buildSnippet,
} from '../../../packages/english/src/grammar/grammar-search'
import type { GrammarOverviewEntry } from '../../../packages/english/src/grammar/hooks/useGrammarOverview'

const entry = (overrides: Partial<GrammarOverviewEntry> = {}): GrammarOverviewEntry => ({
  book: 'essential',
  unitNumber: 3,
  title: 'Present continuous (I am doing)',
  titleZh: '现在进行时',
  category: 'present_continuous',
  categoryZh: '现在进行时',
  difficulty: 1,
  bookPages: [14, 15],
  locked: false,
  ...overrides,
})

describe('tokenizeQuery', () => {
  it('splits on whitespace and lowercases latin', () => {
    expect(tokenizeQuery('  Have BEEN  进行时 ')).toEqual(['have', 'been', '进行时'])
  })
  it('returns [] for empty query', () => {
    expect(tokenizeQuery('   ')).toEqual([])
  })
})

describe('searchGrammarEntries', () => {
  const entries = [
    entry(),
    entry({
      unitNumber: 26,
      title: 'Past simple',
      titleZh: '一般过去时',
      category: 'past_simple',
      categoryZh: '一般过去时',
    }),
    entry({
      unitNumber: 5,
      title: 'do/does',
      titleZh: '疑问句',
      category: 'questions',
      categoryZh: '疑问句',
      locked: true,
    }),
  ]

  it('normal mode matches titleZh across entries', () => {
    const hits = searchGrammarEntries(entries, '进行时', new Map(), 'normal')
    expect(hits.map((h) => h.entry.unitNumber)).toEqual([3])
  })

  it('normal mode: locked entries are searchable', () => {
    const hits = searchGrammarEntries(entries, '疑问句', new Map(), 'normal')
    expect(hits.map((h) => h.entry.unitNumber)).toEqual([5])
    expect(hits[0].entry.locked).toBe(true)
  })

  it('advanced mode requires ALL tokens (AND semantics)', () => {
    const index = new Map([
      ['essential:3', 'Present continuous\n现在进行时\nShe is reading. 她正在看书。'],
      ['essential:26', 'Past simple\n一般过去时\nwas/were 用法'],
    ])
    expect(searchGrammarEntries(entries, 'is reading', index, 'advanced')).toHaveLength(1)
    expect(searchGrammarEntries(entries, 'is sleeping', index, 'advanced')).toHaveLength(0)
  })

  it('advanced mode skips locked entries (no content indexed)', () => {
    const index = new Map([['essential:5', '疑问句 do does']])
    const hits = searchGrammarEntries(entries, 'do', index, 'advanced')
    expect(hits).toHaveLength(0)
  })

  it('metadata hits rank before content hits; same rank by unitNumber', () => {
    // entry 26 的索引文本用填充把「进行时」推到元数据前缀区间之外（前缀长 ≈ metaText 长度 35）
    const filler = 'ab '.repeat(20)
    const index = new Map([
      ['essential:3', 'Present continuous\n现在进行时\nbody only'],
      ['essential:26', `Past simple\n一般过去时\n${filler}含 进行时 的例句`],
    ])
    const hits = searchGrammarEntries(entries, '进行时', index, 'advanced')
    expect(hits.map((h) => [h.entry.unitNumber, h.hitIn])).toEqual([
      [3, 'meta'],
      [26, 'content'],
    ])
  })

  it('advanced mode yields a snippet only for content hits', () => {
    const filler = 'ab '.repeat(20)
    const index = new Map([
      ['essential:3', 'Present continuous\n现在进行时\nShe is reading.'],
      ['essential:26', `Past simple\n一般过去时\n${filler}含 进行时 的例句`],
    ])
    const hits = searchGrammarEntries(entries, '进行时', index, 'advanced')
    expect(hits[0].snippet).toBeUndefined()
    expect(hits[1].snippet?.text).toContain('进行时')
    expect(hits[1].snippet?.ranges.length).toBeGreaterThan(0)
  })
})

describe('buildSnippet', () => {
  const text = 'AAAA'.repeat(20) + ' target ' + 'BBBB'.repeat(20)

  it('windows around first hit with ellipsis', () => {
    const s = buildSnippet(text, ['target'], 10)!
    expect(s.text.startsWith('…')).toBe(true)
    expect(s.text.endsWith('…')).toBe(true)
    expect(s.text).toContain('target')
    const [range] = s.ranges
    expect(s.text.slice(range[0], range[1])).toBe('target')
  })

  it('omits ellipsis at boundaries', () => {
    const s = buildSnippet('target at start', ['target'], 10)!
    expect(s.text.startsWith('…')).toBe(false)
  })

  it('returns null when no token matches', () => {
    expect(buildSnippet('nothing here', ['target'], 10)).toBeNull()
  })
})
