import { describe, expect, it } from 'vitest'
import { lookupMathProblem } from '@rosie/math/utils/math-problem-lookup'

describe('lookupMathProblem', () => {
  it('resolves the current full problem id', () => {
    expect(lookupMathProblem('1-35-P1')?.problemId).toBe('1-35-P1')
  })

  it('resolves a legacy lesson-prefixed problem id', () => {
    expect(lookupMathProblem('35-P1')?.problemId).toBe('1-35-P1')
  })
})
