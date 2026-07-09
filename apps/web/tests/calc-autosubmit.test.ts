import { describe, it, expect } from 'vitest'
import {
  shouldAutoSubmitNumberPad,
  intAnswer,
  decimalAnswer,
  remainderAnswer,
  fractionAnswer,
} from '@rosie/calc'

describe('shouldAutoSubmitNumberPad', () => {
  it('rejects incomplete int prefix', () => {
    expect(shouldAutoSubmitNumberPad('1', intAnswer(12))).toBe(false)
    expect(shouldAutoSubmitNumberPad('12', intAnswer(12))).toBe(true)
  })

  it('rejects wrong full-length int', () => {
    expect(shouldAutoSubmitNumberPad('13', intAnswer(12))).toBe(false)
  })

  it('accepts matching decimal at canonical length', () => {
    const a = decimalAnswer(1.5, 1) // formatAnswer → "1.5"
    expect(shouldAutoSubmitNumberPad('1.', a)).toBe(false)
    expect(shouldAutoSubmitNumberPad('1.5', a)).toBe(true)
  })

  it('never auto-submits rem/frac kinds', () => {
    expect(shouldAutoSubmitNumberPad('3…1', remainderAnswer(3, 1))).toBe(false)
    expect(shouldAutoSubmitNumberPad('1/2', fractionAnswer(1, 2))).toBe(false)
  })

  it('trims whitespace', () => {
    expect(shouldAutoSubmitNumberPad(' 12 ', intAnswer(12))).toBe(true)
  })
})
