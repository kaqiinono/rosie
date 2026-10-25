import { describe, expect, it } from 'vitest'
import { SAMPLE_WORDS_5A } from '../../../packages/english/src/utils/english-data-5a'
import {
  findPassage,
  findPassageByKey,
  readingPassages,
  resolveReadingWordRef,
} from '../../../packages/english/src/utils/reading-data'

const lessons = [
  { unit: 3, lesson: 1, paragraphs: 4, pages: [28, 29], writing: true },
  { unit: 3, lesson: 2, paragraphs: 6, pages: [30, 31], writing: false },
  { unit: 3, lesson: 3, paragraphs: 5, pages: [32, 33], writing: true },
  { unit: 4, lesson: 1, paragraphs: 4, pages: [36, 37], writing: true },
  { unit: 4, lesson: 2, paragraphs: 6, pages: [38, 39], writing: false },
  { unit: 4, lesson: 3, paragraphs: 4, pages: [40, 41], writing: true },
  { unit: 5, lesson: 1, paragraphs: 9, pages: [48, 49], writing: true },
  { unit: 5, lesson: 2, paragraphs: 4, pages: [50, 51], writing: false },
  { unit: 5, lesson: 3, paragraphs: 3, pages: [52, 53], writing: true },
]

describe.each(lessons)('5A Unit $unit Lesson $lesson textbook data', (expected) => {
  const key = `5a-u${expected.unit}l${expected.lesson}`
  const passage = findPassageByKey(key)

  it('registers exactly one stage-aware passage with all source paragraphs', () => {
    expect(readingPassages.filter((entry) => entry.key === key)).toHaveLength(1)
    expect(findPassage('5A', `Unit ${expected.unit}`, `Lesson ${expected.lesson}`)).toBe(passage)
    expect(passage?.paragraphs).toHaveLength(expected.paragraphs)
    if (passage?.paragraphTitles) {
      expect(passage.paragraphTitles).toHaveLength(expected.paragraphs)
    }
  })

  it('resolves full vocabulary tuples and keeps glossary outside the whole stage', () => {
    const words = new Set(SAMPLE_WORDS_5A.map((entry) => entry.word.toLowerCase()))
    for (const entry of passage?.glossary ?? []) {
      expect(words.has(entry.word.toLowerCase())).toBe(false)
    }
    const refs = passage?.learningSections?.flatMap((section) =>
      section.type === 'exercises' ? section.wordRefs ?? [] : [],
    ) ?? []
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) {
      expect(ref).toMatchObject({ stage: '5A', unit: `Unit ${expected.unit}`, lesson: `Lesson ${expected.lesson}` })
      expect(resolveReadingWordRef(ref, SAMPLE_WORDS_5A)?.word).toBe(ref.word)
    }
  })

  it('keeps section order, page provenance and answers usable by ExerciseView', () => {
    const sections = passage?.learningSections ?? []
    expect(sections.map((section) => section.type)).toEqual(
      expected.writing ? ['exercises', 'grammar', 'exercises', 'writing'] : ['exercises', 'grammar', 'exercises'],
    )
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length)
    const groups = sections.flatMap((section) => section.type === 'writing' ? [] : section.groups)
    expect(new Set(groups.map((group) => group.bookPage))).toEqual(new Set(expected.pages))
    for (const group of groups) {
      expect(new Set(group.items.map((item) => item.number)).size).toBe(group.items.length)
      for (const item of group.items) {
        if (item.type === 'multiple_choice' || item.type === 'matching') {
          expect(item.options).toContain(item.answer)
        }
        const blanks = item.prompt.match(/_{6}/g)?.length ?? 0
        if (blanks > 1) expect(item.answer.split('; ')).toHaveLength(blanks)
        if (item.answer === '') {
          expect(item.type).toBe('short_answer')
          // Open answers never reach graded feedback: references must be visible options.
          expect(item.explanation).toBeUndefined()
        }
      }
    }
    for (const section of sections) {
      if (section.type !== 'grammar') continue
      expect(section.grammarRefs.length).toBeGreaterThan(0)
      expect(section.summary.cards.length).toBeGreaterThan(0)
      expect(section.summary.contrasts.length).toBeGreaterThan(0)
      expect(section.summary.decisionGuide.length).toBeGreaterThan(0)
      expect(section.grammarRefs.every((ref) => ref.book !== 'intermediate' || ref.role === 'extension')).toBe(true)
    }
  })
})

describe('source-specific structures', () => {
  it('keeps journal dates and speaker names outside body text', () => {
    expect(findPassageByKey('5a-u3l3')?.paragraphTitles).toEqual(['2 January', '', '3 January', '', ''])
    expect(findPassageByKey('5a-u5l3')?.paragraphTitles).toEqual(['Laura, 15', 'Tomás, 17', 'Chiyo, 16'])
  })

  it('retains the career self-assessment and its three outcomes without grading preferences', () => {
    const passage = findPassageByKey('5a-u5l1')
    expect(passage?.paragraphTitles?.slice(-3)).toEqual(['Mostly a’s', 'Mostly b’s', 'Mostly c’s'])
    const section = passage?.learningSections?.[0]
    if (section?.type !== 'exercises') throw new Error('Missing career discussion')
    expect(section.groups[0].items.at(-1)?.answer).toBe('')
  })

  it('keeps the two-person education question open instead of accepting only one name', () => {
    const section = findPassageByKey('5a-u5l3')?.learningSections?.[0]
    if (section?.type !== 'exercises') throw new Error('Missing future comprehension')
    const group = section.groups.find((entry) => entry.section === '2.5')
    expect(group?.items[0].answer).toBe('')
    expect(group?.items[0].options?.[0]).toContain('Laura')
    expect(group?.items[0].options?.[0]).toContain('Chiyo')
  })
})
