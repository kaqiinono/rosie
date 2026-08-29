import { describe, expect, it } from 'vitest'
import type { CalcProblemState, QuestionAttempt } from '@rosie/core'
import {
  presentationCoefficientFor,
  resolveTargetSec,
  presentationKeyOf,
} from '@rosie/calc'
import { effectiveLimitSec } from '../../../packages/calc/src/utils/calc-effective-limit'
import {
  applyAttempt,
  defaultProblemState,
} from '../../../packages/calc/src/utils/calc-apply-attempt'

describe('presentationCoefficientFor', () => {
  it('returns 1 when no presentation key is given', () => {
    expect(presentationCoefficientFor('add:10', undefined)).toBe(1)
    expect(presentationCoefficientFor(undefined, undefined)).toBe(1)
  })

  it('standard is always the 1.0 baseline', () => {
    expect(presentationCoefficientFor('add:10', 'standard')).toBe(1)
    expect(presentationCoefficientFor('div:rem', 'standard')).toBe(1)
  })

  it('falls back to global defaults for blocks without overrides', () => {
    expect(presentationCoefficientFor('add:10', 'vertical')).toBe(1.5)
    expect(presentationCoefficientFor('add:10', 'inverse-blank')).toBe(1.3)
    expect(presentationCoefficientFor('add:10', 'fraction-input')).toBe(1.4)
    expect(presentationCoefficientFor('add:10', 'remainder-input')).toBe(1.3)
    expect(presentationCoefficientFor('unknown-block', 'vertical')).toBe(1.5)
    expect(presentationCoefficientFor(undefined, 'inverse-blank')).toBe(1.3)
  })

  it('native fraction blocks do not relax fraction-input again', () => {
    expect(presentationCoefficientFor('frac:add-same', 'fraction-input')).toBe(1)
    expect(presentationCoefficientFor('frac:add-diff', 'fraction-input')).toBe(1)
    expect(presentationCoefficientFor('frac:div-frac', 'fraction-input')).toBe(1)
  })

  it('div:rem does not relax remainder-input again', () => {
    expect(presentationCoefficientFor('div:rem', 'remainder-input')).toBe(1)
  })

  it('vertical-native blocks do not relax vertical again', () => {
    expect(presentationCoefficientFor('add:10000', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('sub:10000', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('mul:2d1d-c', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('mul:3d1d-c', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('mul:2d', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('div:multi', 'vertical')).toBe(1)
    expect(presentationCoefficientFor('div:2d1d-borrow', 'vertical')).toBe(1)
  })

  it('carried/borrowed 1000 blocks keep the global vertical relaxation (mixed presentation)', () => {
    expect(presentationCoefficientFor('add:1000', 'vertical')).toBe(1.5)
    expect(presentationCoefficientFor('sub:1000', 'vertical')).toBe(1.5)
  })

  it('overrides only affect their own presentation mode', () => {
    expect(presentationCoefficientFor('div:rem', 'vertical')).toBe(1.5)
    expect(presentationCoefficientFor('frac:add-same', 'inverse-blank')).toBe(1.3)
  })
})

describe('resolveTargetSec with presentation coefficients', () => {
  it('unchanged without presentation key (backward compatible)', () => {
    expect(resolveTargetSec({ explicitSeconds: null, sourceId: 'add:10' })).toBe(4)
  })

  it('relaxes TIME_TARGETS fluent cap by the coefficient', () => {
    expect(
      resolveTargetSec({ explicitSeconds: null, sourceId: 'add:10', presentationKey: 'vertical' }),
    ).toBe(6) // 4 * 1.5
    expect(
      resolveTargetSec({
        explicitSeconds: null,
        sourceId: 'add:10',
        presentationKey: 'inverse-blank',
      }),
    ).toBeCloseTo(5.2) // 4 * 1.3
  })

  it('does not relax native-presentation blocks', () => {
    expect(
      resolveTargetSec({
        explicitSeconds: null,
        sourceId: 'frac:add-same',
        presentationKey: 'fraction-input',
      }),
    ).toBe(5)
    expect(
      resolveTargetSec({
        explicitSeconds: null,
        sourceId: 'mul:2d',
        presentationKey: 'vertical',
      }),
    ).toBe(18)
  })

  it('preserves explicit parent-configured seconds', () => {
    expect(
      resolveTargetSec({ explicitSeconds: 10, sourceId: 'add:10', presentationKey: 'inverse-blank' }),
    ).toBe(10)
    expect(
      resolveTargetSec({ explicitSeconds: 10, sourceId: 'add:10', presentationKey: 'standard' }),
    ).toBe(10)
  })

  it('scales the group default when the source has no TIME_TARGETS entry', () => {
    expect(
      resolveTargetSec({ explicitSeconds: null, sourceId: undefined, presentationKey: 'vertical' }),
    ).toBe(9) // default 6 * 1.5
    expect(resolveTargetSec({ explicitSeconds: null, sourceId: undefined })).toBe(6)
  })
})

describe('effectiveLimitSec with presentation coefficients', () => {
  it('ignores stale explicit seconds when timed answers are off but still applies the coefficient', () => {
    expect(
      effectiveLimitSec({
        timedAnswerEnabled: false,
        explicitSeconds: 10,
        sourceId: 'add:10',
        presentationKey: 'vertical',
      }),
    ).toBe(6) // TIME_TARGETS 4 * 1.5, explicit ignored
  })

  it('preserves explicit seconds when timed answers are on', () => {
    expect(
      effectiveLimitSec({
        timedAnswerEnabled: true,
        explicitSeconds: 10,
        sourceId: 'add:10',
        presentationKey: 'vertical',
      }),
    ).toBe(10)
  })
})

describe('applyAttempt records presentationKey', () => {
  const attempt: QuestionAttempt = {
    correct: true,
    timeMs: 2000,
    evidenceKind: 'independent',
  }

  it('stores the presentation key on the attempt evidence', () => {
    const prev = defaultProblemState('add(1,2)', 1)
    const next = applyAttempt(prev, attempt, true, 1, '2026-01-01', 'vertical')
    expect(next.recentResults.at(-1)?.presentationKey).toBe('vertical')
  })

  it('omits the field when no presentation key is provided', () => {
    const prev = defaultProblemState('add(1,2)', 1)
    const next = applyAttempt(prev, attempt, true, 1, '2026-01-01')
    expect(next.recentResults.at(-1)?.presentationKey).toBeUndefined()
  })

  it('mastery progression is unaffected by the extra parameter', () => {
    let state: CalcProblemState = defaultProblemState('add(1,2)', 1)
    for (let sessionNo = 1; sessionNo <= 3; sessionNo++) {
      state = applyAttempt(state, attempt, true, sessionNo, '2026-01-01', 'inverse-blank')
    }
    expect(state.proficiency).toBe(3)
    expect(state.consecutiveCorrect).toBe(3)
  })
})

describe('presentationKeyOf derivation', () => {
  it('prefers vertical over other markers', () => {
    expect(
      presentationKeyOf({
        answerMode: 'vertical',
        display: '48+□=105',
        answer: { kind: 'int', value: 57 },
      } as never),
    ).toBe('vertical')
  })
})
