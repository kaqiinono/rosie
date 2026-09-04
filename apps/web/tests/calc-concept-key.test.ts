import { describe, it, expect } from 'vitest'
import { conceptKeyOf, presentationKeyOf, isSelfConcept } from '@rosie/calc'
import { CalcQuestion } from '@rosie/core'

describe('conceptKeyOf', () => {
  it('normalizes commutative add: smaller operand first', () => {
    expect(conceptKeyOf('add(7,2)')).toBe('add(2,7)')
    expect(conceptKeyOf('add(2,7)')).toBe('add(2,7)')
    expect(conceptKeyOf('add(3,3)')).toBe('add(3,3)')
  })

  it('normalizes commutative mul: smaller operand first', () => {
    expect(conceptKeyOf('mul(8,3)')).toBe('mul(3,8)')
    expect(conceptKeyOf('mul(3,8)')).toBe('mul(3,8)')
    expect(conceptKeyOf('mul(5,5)')).toBe('mul(5,5)')
  })

  it('preserves order for non-commutative sub', () => {
    expect(conceptKeyOf('sub(7,2)')).toBe('sub(7,2)')
    expect(conceptKeyOf('sub(2,7)')).toBe('sub(2,7)')
  })

  it('preserves order for non-commutative div', () => {
    expect(conceptKeyOf('div(6,2)')).toBe('div(6,2)')
    expect(conceptKeyOf('div(2,6)')).toBe('div(2,6)')
  })

  it('preserves numeric-only signatures', () => {
    expect(conceptKeyOf('42')).toBe('42')
  })

  it('preserves nested/complex signatures', () => {
    expect(conceptKeyOf('add(add(1,2),3)')).toBe('add(add(1,2),3)')
    expect(conceptKeyOf('sub(add(5,3),2)')).toBe('sub(add(5,3),2)')
  })

  it('handles invalid signatures gracefully', () => {
    expect(conceptKeyOf('')).toBe('')
    expect(conceptKeyOf('garbage')).toBe('garbage')
  })
})

describe('isSelfConcept', () => {
  it('detects double addition', () => {
    expect(isSelfConcept('add(3,3)')).toBe(true)
    expect(isSelfConcept('add(3,4)')).toBe(false)
  })

  it('detects self multiplication', () => {
    expect(isSelfConcept('mul(5,5)')).toBe(true)
    expect(isSelfConcept('mul(5,6)')).toBe(false)
  })

  it('returns false for non-add/mul', () => {
    expect(isSelfConcept('sub(3,3)')).toBe(false)
    expect(isSelfConcept('div(6,6)')).toBe(false)
  })
})

describe('presentationKeyOf', () => {
  it('detects vertical mode', () => {
    expect(presentationKeyOf({ answerMode: 'vertical' } as CalcQuestion)).toBe('vertical')
  })

  it('detects inverse-blank from display', () => {
    expect(
      presentationKeyOf({ display: '7+□=9', answer: { kind: 'int', value: 2 } } as CalcQuestion),
    ).toBe('inverse-blank')
  })

  it('detects fraction-input', () => {
    expect(
      presentationKeyOf({
        display: '1/2+1/2',
        answer: { kind: 'fraction', num: 1, den: 2 },
      } as CalcQuestion),
    ).toBe('fraction-input')
  })

  it('detects remainder-input', () => {
    expect(
      presentationKeyOf({
        display: '7÷3',
        answer: { kind: 'remainder', quotient: 2, remainder: 1 },
      } as CalcQuestion),
    ).toBe('remainder-input')
  })

  it('defaults to standard', () => {
    expect(
      presentationKeyOf({ display: '7+2', answer: { kind: 'int', value: 9 } } as CalcQuestion),
    ).toBe('standard')
  })
})
