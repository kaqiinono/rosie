import { describe, it, expect } from 'vitest'
import {
  normalizeQuizTypes,
  buildQuizQuestions,
  buildQuizOptions,
  hilite,
  highlightExample,
  getFilteredWords,
  shuffle,
  wordKey,
} from '@/utils/english-helpers'
import type { WordEntry } from '@rosie/core'

const w = (overrides: Partial<WordEntry>): WordEntry => ({
  unit: 'U1',
  lesson: 'L1',
  word: 'word',
  explanation: 'gloss',
  ...overrides,
})

const VOCAB: WordEntry[] = [
  w({ word: 'cat', explanation: '猫', unit: 'U1', lesson: 'L1' }),
  w({ word: 'dog', explanation: '狗', unit: 'U1', lesson: 'L1' }),
  w({ word: 'fish', explanation: '鱼', unit: 'U1', lesson: 'L1' }),
  w({ word: 'apple', explanation: '苹果', unit: 'U1', lesson: 'L2' }),
  w({ word: 'banana', explanation: '香蕉', unit: 'U1', lesson: 'L2' }),
  w({ word: 'grape', explanation: '葡萄', unit: 'U2', lesson: 'L3', stage: 'G2' }),
]

describe('normalizeQuizTypes', () => {
  it('preserves canonical A→B→C order', () => {
    expect(normalizeQuizTypes(['A', 'B', 'C'])).toEqual(['A', 'B', 'C'])
  })

  it('reorders to canonical regardless of input order', () => {
    expect(normalizeQuizTypes(['C', 'A'])).toEqual(['A', 'C'])
    expect(normalizeQuizTypes(['B', 'A'])).toEqual(['A', 'B'])
  })

  it('deduplicates', () => {
    expect(normalizeQuizTypes(['B', 'B', 'A', 'A'])).toEqual(['A', 'B'])
  })

  it('handles empty input', () => {
    expect(normalizeQuizTypes([])).toEqual([])
  })
})

describe('buildQuizQuestions', () => {
  it('returns empty when no words or no types', () => {
    expect(buildQuizQuestions([], ['A'], 1)).toEqual([])
    expect(buildQuizQuestions(VOCAB.slice(0, 1), [], 1)).toEqual([])
  })

  it('emits words × types questions', () => {
    const qs = buildQuizQuestions(VOCAB.slice(0, 3), ['A', 'B', 'C'], 42)
    expect(qs.length).toBe(9)
  })

  it('preserves A → B → C order per word', () => {
    const qs = buildQuizQuestions(VOCAB.slice(0, 3), ['A', 'B', 'C'], 42)
    const order = new Map<string, ('A' | 'B' | 'C' | 'D')[]>()
    for (const q of qs) {
      const arr = order.get(q.word.word) ?? []
      arr.push(q.type)
      order.set(q.word.word, arr)
    }
    for (const seq of order.values()) {
      expect(seq).toEqual(['A', 'B', 'C'])
    }
  })

  it('is deterministic for a given seed', () => {
    const a = buildQuizQuestions(VOCAB.slice(0, 3), ['A', 'B'], 100)
    const b = buildQuizQuestions(VOCAB.slice(0, 3), ['A', 'B'], 100)
    expect(a.map((q) => `${q.word.word}|${q.type}`)).toEqual(
      b.map((q) => `${q.word.word}|${q.type}`),
    )
  })
})

describe('buildQuizOptions', () => {
  it('returns exactly 4 options including the correct word', () => {
    const opts = buildQuizOptions(VOCAB[0], VOCAB, 1)
    expect(opts.length).toBe(4)
    expect(opts.some((o) => o.word === VOCAB[0].word)).toBe(true)
  })

  it('never duplicates entries', () => {
    const opts = buildQuizOptions(VOCAB[0], VOCAB, 7)
    const set = new Set(opts.map((o) => o.word))
    expect(set.size).toBe(opts.length)
  })

  it('is deterministic for a given seed', () => {
    const a = buildQuizOptions(VOCAB[0], VOCAB, 9).map((o) => o.word)
    const b = buildQuizOptions(VOCAB[0], VOCAB, 9).map((o) => o.word)
    expect(a).toEqual(b)
  })
})

describe('hilite', () => {
  it('returns escaped text when no keywords supplied or matched', () => {
    expect(hilite('a < b')).toBe('a &lt; b')
  })

  it('wraps matched keywords in span with class', () => {
    const out = hilite('a quick fox', [['quick', 'kw']])
    expect(out).toContain('<span class="kw">quick</span>')
  })

  it('escapes hostile characters around matches', () => {
    const out = hilite('<b>quick</b>', [['quick', 'kw']])
    expect(out).toContain('&lt;b&gt;')
    expect(out).toContain('<span class="kw">quick</span>')
    expect(out).not.toContain('<b>')
  })

  it('prefers longest keyword match (no overlap)', () => {
    const out = hilite('quick brown fox', [
      ['quick', 'a'],
      ['quick brown', 'b'],
    ])
    expect(out).toContain('<span class="b">quick brown</span>')
    expect(out).not.toContain('<span class="a">')
  })
})

describe('highlightExample', () => {
  it('bolds the word inside a sentence', () => {
    expect(highlightExample('I have a cat.', 'cat')).toBe('I have a <strong>cat</strong>.')
  })

  it('case-insensitive when the word stands alone', () => {
    expect(highlightExample('A CAT and a cat.', 'cat')).toBe(
      'A <strong>CAT</strong> and a <strong>cat</strong>.',
    )
  })

  it('respects word boundaries (does not match plural "cats")', () => {
    expect(highlightExample('Cats run fast.', 'cat')).toBe('Cats run fast.')
  })

  it('escapes HTML in the source', () => {
    expect(highlightExample('A <b>cat</b>', 'cat')).toContain('&lt;b&gt;')
  })
})

describe('getFilteredWords', () => {
  it('returns all when no filters', () => {
    expect(getFilteredWords(VOCAB, '', new Set(), new Set(), new Set()).length).toBe(VOCAB.length)
  })

  it('keeps matching-stage words and all unstaged words', () => {
    const out = getFilteredWords(VOCAB, 'G2', new Set(), new Set(), new Set())
    expect(out.every((v) => !v.stage || v.stage === 'G2')).toBe(true)
    expect(out.map((v) => v.word)).toContain('grape')
  })

  it('drops words tagged with a different stage', () => {
    const tagged: WordEntry[] = [w({ word: 'one', stage: 'G1' }), w({ word: 'two', stage: 'G2' })]
    const out = getFilteredWords(tagged, 'G2', new Set(), new Set(), new Set())
    expect(out.map((v) => v.word)).toEqual(['two'])
  })

  it('filters by unit', () => {
    const out = getFilteredWords(VOCAB, '', new Set(['U2']), new Set(), new Set())
    expect(out.map((v) => v.word)).toEqual(['grape'])
  })

  it('filters by lesson (unit::lesson key)', () => {
    const out = getFilteredWords(VOCAB, '', new Set(), new Set(['U1::L2']), new Set())
    expect(out.map((v) => v.word).sort()).toEqual(['apple', 'banana'])
  })

  it('filters by word', () => {
    const out = getFilteredWords(VOCAB, '', new Set(), new Set(), new Set(['cat']))
    expect(out.map((v) => v.word)).toEqual(['cat'])
  })
})

describe('shuffle', () => {
  it('is deterministic for the same seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42)
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42)
    expect(a).toEqual(b)
  })

  it('returns same elements (permutation)', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, 1)
    expect(out.sort()).toEqual(input)
  })
})

describe('wordKey', () => {
  it('joins unit, lesson, and word', () => {
    expect(wordKey(w({ unit: 'U1', lesson: 'L2', word: 'apple' }))).toBe('U1::L2::apple')
  })
})
