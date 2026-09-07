import { describe, expect, it } from 'vitest'
import { allocatePercentages, buildSession } from '../calc-helpers'
import type { CalcSettings } from '@rosie/core'

describe('allocatePercentages', () => {
  it('allocates the session total from percentage weights', () => {
    expect(allocatePercentages(20, [25, 75])).toEqual([5, 15])
  })

  it('gives a source at least one question when its calculated share is below one', () => {
    expect(allocatePercentages(10, [1, 99])).toEqual([1, 9])
  })

  it('allows the actual total to grow when there are more sources than questions', () => {
    expect(allocatePercentages(2, [20, 20, 20, 20, 20])).toEqual([1, 1, 1, 1, 1])
  })
})

describe('adaptive session target', () => {
  it('expands past the target so every configured source gets one question', () => {
    const settings: CalcSettings = {
      countMode: 'auto',
      selectedBlocks: [
        'add:10',
        'sub:10',
        'add:20a',
        'add:20b',
        'sub:20a',
      ].map((id) => ({ id, count: 20, seconds: 0 })),
      mixedOps: [],
      soundEnabled: false,
      includeInverse: false,
      verticalForBigNumbers: false,
      timedAnswerEnabled: false,
      immersiveMode: false,
      lastCount: 2,
      sessionCounter: 0,
      timingMode: 'relaxed',
      bonusSec: 3,
      autoSubmitOnMatch: true,
      adaptiveExpansionEnabled: false,
    }

    const session = buildSession(settings, { problemStates: new Map() }, [], 2)

    expect(session).toHaveLength(5)
    expect(new Set(session.map((question) => question.sourceBlockId))).toHaveLength(5)
  })
})
