import { describe, it, expect } from 'vitest'
import { canAutoEnterMathPlanPractice } from '../../../packages/math/src/utils/math-plan-practice-entry'

describe('math plan practice entry gate', () => {
  it('does not auto-enter practice on the plan hub', () => {
    expect(canAutoEnterMathPlanPractice(false)).toBe(false)
  })

  it('allows resume / auto-start on the practice route', () => {
    expect(canAutoEnterMathPlanPractice(true)).toBe(true)
  })
})
