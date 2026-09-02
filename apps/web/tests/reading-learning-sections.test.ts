import { describe, expect, it } from 'vitest'
import { SAMPLE_WORDS_5A } from '../../../packages/english/src/utils/english-data-5a'
import {
  buildWordMatchRegex,
  findPassage,
  findPassageByKey,
  resolveMatchedWord,
  resolveReadingWordRef,
} from '../../../packages/english/src/utils/reading-data'

describe('Stage 5A Unit 1 Lesson 1 reading course', () => {
  const passage = findPassageByKey('5a-u1l1')

  it('registers a stage-aware six-part passage', () => {
    expect(passage).toBeDefined()
    expect(findPassage('5A', 'Unit 1', 'Lesson 1')?.key).toBe('5a-u1l1')
    expect(passage?.paragraphs).toHaveLength(6)
    expect(passage?.paragraphTitles).toEqual([
      'Friday, 10 July',
      'Sunday, 12 July',
      'Monday, 13 July',
      'Tuesday, 14 July',
      'Friday, 17 July',
      'Sunday, 19 July',
    ])
    expect(passage?.paragraphs[0]).not.toContain('Friday, 10 July')
    expect(passage?.paragraphs[5]).toContain('Goodbye, Peru!')
  })

  it('keeps glossary entries separate from existing lesson words', () => {
    const existing = new Set(
      SAMPLE_WORDS_5A
        .filter((word) => word.unit === 'Unit 1' && word.lesson === 'Lesson 1')
        .map((word) => word.word.toLowerCase()),
    )
    for (const entry of passage?.glossary ?? []) {
      expect(existing.has(entry.word.toLowerCase())).toBe(false)
    }
  })

  it('resolves every exercise word reference from the existing 5A lesson vocabulary', () => {
    const refs = (passage?.learningSections ?? []).flatMap((section) =>
      section.type === 'exercises' ? (section.wordRefs ?? []) : [],
    )
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) {
      expect(resolveReadingWordRef(ref, SAMPLE_WORDS_5A)?.word).toBe(ref.word)
    }
  })

  it('keeps matching answers inside the supplied options', () => {
    const groups = (passage?.learningSections ?? []).flatMap((section) =>
      section.type === 'writing' ? [] : section.groups,
    )
    for (const item of groups.flatMap((group) => group.items).filter((item) => item.type === 'matching')) {
      expect(item.options).toContain(item.answer)
    }
  })

  it('matches labelled vocabulary forms such as honouring → honour (AmE honor)', () => {
    const entry = SAMPLE_WORDS_5A.find((word) => word.word === 'honour (AmE honor)')
    expect(entry).toBeDefined()
    const regex = buildWordMatchRegex([entry!.word])
    expect("honouring Peru's national hero".match(regex!)).toContain('honouring')
    expect(resolveMatchedWord('honouring', [entry!])).toBe(entry)
  })

  it('contains the planned exercise and writing sections', () => {
    const sections = passage?.learningSections ?? []
    expect(sections.map((section) => section.id)).toEqual([
      'reading-comprehension',
      'present-simple-vs-continuous',
      'place-vocabulary',
      'famous-place-writing',
    ])
    const grammar = sections.find((section) => section.type === 'grammar')
    expect(grammar?.grammarRefs.find((ref) => ref.role === 'primary')?.unitNumber).toBe(8)
    const writing = sections.find((section) => section.type === 'writing')
    expect(writing?.modelAnswer).toHaveLength(5)
  })
})

describe('Stage 5A Unit 1 Lesson 2 reading course', () => {
  const passage = findPassageByKey('5a-u1l2')
  const sections = passage?.learningSections ?? []

  it('registers the article and keeps the callout heading outside its paragraph', () => {
    expect(passage).toBeDefined()
    expect(findPassage('5A', 'Unit 1', 'Lesson 2')?.key).toBe('5a-u1l2')
    expect(passage?.paragraphs).toHaveLength(4)
    expect(passage?.paragraphTitles).toEqual(['', '', '', 'Guess what!'])
    expect(passage?.paragraphs[3]).not.toContain('Guess what!')
    expect(passage?.paragraphs[3]).toContain('Supai Village')
  })

  it('keeps every glossary entry outside the entire 5A vocabulary library', () => {
    const existing = new Set(SAMPLE_WORDS_5A.map((word) => word.word.toLowerCase()))
    for (const entry of passage?.glossary ?? []) {
      expect(existing.has(entry.word.toLowerCase())).toBe(false)
    }
  })

  it('resolves every lesson word reference with its full tuple', () => {
    const refs = sections.flatMap((section) =>
      section.type === 'exercises' ? (section.wordRefs ?? []) : [],
    )
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) {
      expect(ref).toMatchObject({ stage: '5A', unit: 'Unit 1', lesson: 'Lesson 2' })
      expect(resolveReadingWordRef(ref, SAMPLE_WORDS_5A)?.word).toBe(ref.word)
    }
  })

  it('keeps every selectable answer inside its supplied options', () => {
    const groups = sections.flatMap((section) =>
      section.type === 'writing' ? [] : section.groups,
    )
    for (const item of groups.flatMap((group) => group.items).filter((item) => item.options)) {
      expect(item.options).toContain(item.answer)
    }
  })

  it('provides textbook-backed summary, grammar and vocabulary tabs without invented writing', () => {
    expect(sections.map((section) => section.id)).toEqual([
      'reading-comprehension',
      'stative-verbs',
      'place-vocabulary',
    ])
    const grammar = sections.find((section) => section.type === 'grammar')
    expect(grammar?.grammarRefs.find((ref) => ref.role === 'primary')?.unitNumber).toBe(8)
    expect(grammar?.summary.cards.flatMap((card) => card.points).map((point) => point.text)).toContain(
      'What do you think of the view?',
    )
    expect(sections.some((section) => section.type === 'writing')).toBe(false)
  })
})
