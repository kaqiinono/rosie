import { describe, it, expect } from 'vitest'
import {
  digitsOf,
  hasAnyCarry,
  hasConsecutiveCarries,
  needsDivMidRemainder,
  enumerateComplementsTo100,
  genMul3d1d,
  genDiv2d1d,
  genSubRound,
  genZerosMul,
  genZerosDiv,
} from '@rosie/calc'

describe('digitsOf / carry', () => {
  it('digitsOf is ones-first', () => {
    expect(digitsOf(412)).toEqual([2, 1, 4])
  })

  it('412×3 is single-carry only (not consecutive)', () => {
    expect(hasAnyCarry(412, 3)).toBe(true)
    expect(hasConsecutiveCarries(412, 3, 2)).toBe(false)
  })

  it('38×3 has a carry; 42×2 has none', () => {
    expect(hasAnyCarry(38, 3)).toBe(true)
    expect(hasAnyCarry(42, 2)).toBe(false)
  })

  it('144×3 has consecutive carries', () => {
    expect(hasConsecutiveCarries(144, 3, 2)).toBe(true)
  })
})

describe('div mid-remainder', () => {
  it('72÷4 needs mid remainder; 84÷4 does not', () => {
    expect(needsDivMidRemainder(72, 4)).toBe(true) // tens 7 % 4 !== 0
    expect(needsDivMidRemainder(84, 4)).toBe(false) // tens 8 % 4 === 0
  })
})

describe('complements Finite U', () => {
  it('includes both orders and 50+50 once', () => {
    const pairs = enumerateComplementsTo100()
    expect(pairs).toContainEqual([34, 66])
    expect(pairs).toContainEqual([66, 34])
    expect(pairs.filter(([a, b]) => a === 50 && b === 50)).toHaveLength(1)
    expect(pairs.every(([a, b]) => a >= 10 && a <= 90 && b >= 10 && b <= 90 && a + b === 100)).toBe(true)
  })
})

describe('generators sample invariants', () => {
  it('genMul3d1d(true) always consecutive-carry', () => {
    for (let i = 0; i < 40; i++) {
      const [a, k] = genMul3d1d(true)
      expect(a).toBeGreaterThanOrEqual(100)
      expect(a).toBeLessThanOrEqual(999)
      expect(hasConsecutiveCarries(a, k, 2)).toBe(true)
    }
  })

  it('genDiv2d1d partitions by borrow flag', () => {
    for (let i = 0; i < 40; i++) {
      const [d, div] = genDiv2d1d(true)
      expect(d % div).toBe(0)
      expect(needsDivMidRemainder(d, div)).toBe(true)
      const [d2, div2] = genDiv2d1d(false)
      expect(d2 % div2).toBe(0)
      expect(needsDivMidRemainder(d2, div2)).toBe(false)
    }
  })

  it('genSubRound only 100 or 1000', () => {
    for (let i = 0; i < 30; i++) {
      const [a, b] = genSubRound()
      expect([100, 1000]).toContain(a)
      expect(b).toBeGreaterThan(0)
      expect(b).toBeLessThan(a)
    }
  })

  it('zeros mul/div are exact and use trailing zeros', () => {
    for (let i = 0; i < 20; i++) {
      const [a, b] = genZerosMul()
      expect(a * b).toBeGreaterThan(0)
      expect(a % 10 === 0 || b % 10 === 0).toBe(true)
      const [num, den] = genZerosDiv()
      expect(num % den).toBe(0)
      expect(num % 10 === 0 || den % 10 === 0).toBe(true)
    }
  })
})
