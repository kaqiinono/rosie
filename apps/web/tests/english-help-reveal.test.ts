import { describe, expect, it } from 'vitest'
import {
  buildReinforcementQuestions,
  helpRevealCount,
  wordKey,
} from '@rosie/english/utils/english-helpers'
import { SAMPLE_WORDS_5A } from '@rosie/english/utils/english-data-5a'

describe('English word help reveal', () => {
  it('reveals 1, 2, 4, 8 new letters on successive clicks', () => {
    expect([0, 1, 2, 3, 4].map((clicks) => helpRevealCount(clicks, 20))).toEqual([
      0,
      1,
      3,
      7,
      15,
    ])
  })

  it('caps the cumulative reveal at the word length', () => {
    expect(helpRevealCount(3, 8)).toBe(7)
    expect(helpRevealCount(4, 8)).toBe(8)
  })

  it('keeps reinforcement at one question per help click', () => {
    const fountain = SAMPLE_WORDS_5A.find((entry) => entry.word === 'fountain')
    expect(fountain).toBeDefined()
    if (!fountain) return

    const questions = buildReinforcementQuestions(
      { [wordKey(fountain)]: 4 },
      SAMPLE_WORDS_5A,
      wordKey,
      1,
    )

    expect(questions).toHaveLength(4)
    expect(questions.every((question) => question.word.word === 'fountain')).toBe(true)
  })
})
