import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../../../packages/core/src/type'
import {
  blankWordInSentence,
  buildEntryMatchRegex,
  buildEntryRegex,
  findSentenceForWord,
  resolveWordFormMatch,
} from '../../../packages/english/src/utils/reading-data'
import { getWordFormCandidates } from '../../../packages/english/src/utils/word-forms'

function entry(word: string, wordForms?: WordEntry['wordForms']): WordEntry {
  return { unit: 'Unit 1', lesson: 'Lesson 1', word, explanation: '', wordForms }
}

describe('reading word-form matching', () => {
  it('generates regular verb forms including consonant doubling', () => {
    const climb = entry('climb')
    const run = entry('run')
    const climbForms = getWordFormCandidates(climb).map((form) => form.text)
    const runForms = getWordFormCandidates(run).map((form) => form.text)

    expect(climbForms).toEqual(expect.arrayContaining(['climb', 'climbs', 'climbing', 'climbed']))
    expect(runForms).toContain('running')
  })

  it('resolves an explicit irregular surface form to its base entry', () => {
    const think = entry('think', {
      past: ['thought'],
      pastParticiple: ['thought'],
    })
    const match = resolveWordFormMatch('thought', [think])

    expect(match?.entry).toBe(think)
    expect(match?.source).toBe('explicit')
    expect(match?.formTypes).toEqual(['past', 'pastParticiple'])
  })

  it('matches irregular plurals and phrasal verbs', () => {
    const child = entry('child', { plural: ['children'] })
    const takeOff = entry('take off', {
      past: ['took off'],
      pastParticiple: ['taken off'],
    })
    const regex = buildEntryMatchRegex([child, takeOff])
    const matches = 'The children took off early.'.match(regex!)

    expect(matches).toEqual(['children', 'took off'])
    expect(resolveWordFormMatch('children', [child, takeOff])?.entry).toBe(child)
    expect(resolveWordFormMatch('took off', [child, takeOff])?.entry).toBe(takeOff)
  })

  it('uses explicit forms for sentence lookup and blanking', () => {
    const think = entry('think', { past: ['thought'], pastParticiple: ['thought'] })
    const passage = {
      key: 'test', stage: '5A', unit: 'Unit 1', lesson: 'Lesson 1', title: 'Test',
      paragraphs: ['I thought about the problem.'],
    }

    expect(buildEntryRegex(think).test('thought')).toBe(true)
    expect(findSentenceForWord(passage, think)?.sentence).toBe('I thought about the problem.')
    expect(blankWordInSentence(passage.paragraphs[0], think)).toBe('I _______ about the problem.')
  })

  it('can suppress invalid generated forms for modal words', () => {
    const can = entry('can', {
      other: ['could'],
      disableGenerated: [
        'plural', 'thirdPerson', 'presentParticiple', 'past', 'pastParticiple',
        'comparative', 'superlative',
      ],
    })
    const forms = getWordFormCandidates(can).map((form) => form.text)

    expect(forms).toEqual(['can', 'could'])
    expect(forms).not.toContain('cans')
  })

  it('normalizes catalog labels and optional parenthetical text', () => {
    expect(getWordFormCandidates(entry('blog (verb)')).map((form) => form.text)).toContain('blog')
    expect(getWordFormCandidates(entry('sport(s)')).map((form) => form.text)).toEqual(
      expect.arrayContaining(['sport', 'sports']),
    )
    expect(getWordFormCandidates(entry('(catch a) cold')).map((form) => form.text)).toEqual(
      expect.arrayContaining(['cold', 'catch a cold']),
    )
  })
})
