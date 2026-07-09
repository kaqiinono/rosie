import { describe, it, expect } from 'vitest'
import {
  GRADUATED_STAGE_NORMAL,
  GRADUATED_STAGE_HARD,
  type WordMasteryInfo,
} from '@rosie/core'
import { mapWordToPlanInit, allWordsMastered } from '../../../packages/english/src/utils/adaptivePlanInit'

const KEY = 'U1::L1::cat'

const mastery = (overrides: Partial<WordMasteryInfo> = {}): WordMasteryInfo => ({
  correct: 0,
  incorrect: 0,
  lastSeen: '',
  ...overrides,
})

describe('mapWordToPlanInit', () => {
  it('maps missing mastery to NOT_STARTED', () => {
    expect(mapWordToPlanInit(KEY, undefined, false)).toEqual({
      word_key: KEY,
      status: 'NOT_STARTED',
      target_box: null,
    })
  })

  it('maps stage 0 to NOT_STARTED', () => {
    expect(mapWordToPlanInit(KEY, mastery({ stage: 0 }), false)).toEqual({
      word_key: KEY,
      status: 'NOT_STARTED',
      target_box: null,
    })
  })

  it('maps stage 2 to LEARNING_PENDING target_box 1', () => {
    expect(mapWordToPlanInit(KEY, mastery({ stage: 2 }), false)).toEqual({
      word_key: KEY,
      status: 'LEARNING_PENDING',
      target_box: 1,
    })
  })

  it('maps stage 4 to LEARNING_PENDING target_box 3', () => {
    expect(mapWordToPlanInit(KEY, mastery({ stage: 4 }), false)).toEqual({
      word_key: KEY,
      status: 'LEARNING_PENDING',
      target_box: 3,
    })
  })

  it('maps stage 5 to MASTERED', () => {
    expect(mapWordToPlanInit(KEY, mastery({ stage: 5 }), false)).toEqual({
      word_key: KEY,
      status: 'MASTERED',
      target_box: null,
    })
  })

  it('maps graduated (stage 7 normal) to MASTERED', () => {
    expect(
      mapWordToPlanInit(KEY, mastery({ stage: GRADUATED_STAGE_NORMAL }), false),
    ).toEqual({
      word_key: KEY,
      status: 'MASTERED',
      target_box: null,
    })
  })

  it('maps graduated hard (stage 8) to MASTERED', () => {
    expect(
      mapWordToPlanInit(
        KEY,
        mastery({ stage: GRADUATED_STAGE_HARD, isHard: true }),
        false,
      ),
    ).toEqual({
      word_key: KEY,
      status: 'MASTERED',
      target_box: null,
    })
  })

  it('forceChallenge remaps MASTERED to LEARNING_PENDING box 3', () => {
    expect(mapWordToPlanInit(KEY, mastery({ stage: 6 }), true)).toEqual({
      word_key: KEY,
      status: 'LEARNING_PENDING',
      target_box: 3,
    })
    expect(
      mapWordToPlanInit(KEY, mastery({ stage: GRADUATED_STAGE_NORMAL }), true),
    ).toEqual({
      word_key: KEY,
      status: 'LEARNING_PENDING',
      target_box: 3,
    })
  })
})

describe('allWordsMastered', () => {
  it('returns false for empty list', () => {
    expect(allWordsMastered([])).toBe(false)
  })

  it('returns false when any init is not MASTERED', () => {
    expect(
      allWordsMastered([
        { word_key: 'a', status: 'MASTERED', target_box: null },
        { word_key: 'b', status: 'NOT_STARTED', target_box: null },
      ]),
    ).toBe(false)
  })

  it('returns true when every init is MASTERED', () => {
    expect(
      allWordsMastered([
        { word_key: 'a', status: 'MASTERED', target_box: null },
        { word_key: 'b', status: 'MASTERED', target_box: null },
      ]),
    ).toBe(true)
  })
})
