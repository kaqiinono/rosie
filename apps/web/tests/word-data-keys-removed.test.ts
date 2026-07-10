import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../../../packages/core/src/type'
import { keysRemovedFromVocab } from '../../../packages/english/src/hooks/useWordData'

function entry(overrides: Partial<WordEntry>): WordEntry {
  return {
    unit: 'U1',
    lesson: 'L1',
    word: 'cat',
    explanation: 'a cat',
    ...overrides,
  }
}

describe('keysRemovedFromVocab', () => {
  it('returns keys of deleted words that no longer exist in remaining vocab', () => {
    const deleted = [entry({ word: 'cat' }), entry({ word: 'dog' })]
    const remaining = [entry({ word: 'fish' })]
    expect(keysRemovedFromVocab(deleted, remaining).sort()).toEqual([
      'U1::L1::cat',
      'U1::L1::dog',
    ])
  })

  it('keeps a key when another stage still carries the same unit/lesson/word', () => {
    const deleted = [entry({ word: 'cat', stage: '3A' })]
    const remaining = [entry({ word: 'cat', stage: '3B' })]
    expect(keysRemovedFromVocab(deleted, remaining)).toEqual([])
  })

  it('dedupes keys and handles empty input', () => {
    const deleted = [entry({ word: 'cat', stage: '3A' }), entry({ word: 'cat', stage: '3B' })]
    expect(keysRemovedFromVocab(deleted, [])).toEqual(['U1::L1::cat'])
    expect(keysRemovedFromVocab([], [])).toEqual([])
  })
})
