import { describe, expect, it } from 'vitest'
import {
  canonicalizeIntegerFact,
  coverageSignature,
  curriculumForBlock,
  evaluateIntegerFact,
  isGloballyEligible,
} from '@rosie/calc'

describe('indexed integer curriculum', () => {
  it('locks add:10 to the exact 25-fact nondecreasing sequence', () => {
    const c = curriculumForBlock('add:10')!
    const expected: string[] = []
    for (let a = 1; a <= 9; a++) {
      for (let b = a; b <= 9; b++) if (a + b <= 10) expected.push(`add(${a},${b})`)
    }
    expect(c.count()).toBe(25)
    expect(Array.from({ length: c.count() }, (_, i) => coverageSignature(c.unrank(i)))).toEqual(expected)
  })

  it('rank/unrank and difficulty order are stable for every registered curriculum', () => {
    for (const id of [
      'add:10', 'add:100a', 'add:100b', 'add:100-comp',
      'sub:100a', 'sub:100b', 'sub:round',
      'mul:67', 'mul:89', 'mul:2d1d-nc', 'mul:2d1d-c',
      'mul:3d1d-nc', 'mul:3d1d-c', 'mul:zeros',
    ]) {
      const c = curriculumForBlock(id)!
      expect(c.count(), id).toBeGreaterThan(0)
      let previous: readonly number[] | null = null
      for (let i = 0; i < c.count(); i++) {
        const fact = c.unrank(i)
        expect(c.rank(fact), `${id}#${i}`).toBe(i)
        expect(c.contains(fact), `${id}#${i}`).toBe(true)
        expect(isGloballyEligible(fact), `${id}#${i}`).toBe(true)
        expect(Number.isFinite(evaluateIntegerFact(fact))).toBe(true)
        const key = c.difficultyKey(fact)
        if (previous) expect(compare(previous, key), `${id}#${i}`).toBeLessThanOrEqual(0)
        previous = key
      }
    }
  }, 30_000)

  it('canonicalizes commutative facts but preserves directional facts', () => {
    expect(canonicalizeIntegerFact({ op: 'add', left: 9, right: 1 })).toEqual({ op: 'add', left: 1, right: 9 })
    expect(coverageSignature({ op: 'mul', left: 9, right: 6 })).toBe('mul(6,9)')
    expect(canonicalizeIntegerFact({ op: 'sub', left: 9, right: 2 })).toEqual({ op: 'sub', left: 9, right: 2 })
  })

  it.each([
    { op: 'add', left: 5, right: 0 },
    { op: 'sub', left: 5, right: 0 },
    { op: 'sub', left: 5, right: 5 },
    { op: 'sub', left: 5, right: 4 },
    { op: 'mul', left: 1, right: 8 },
    { op: 'mul', left: 0, right: 8 },
    { op: 'div', left: 8, right: 1 },
    { op: 'div', left: 8, right: 8 },
  ] as const)('excludes identity/zero fact $op($left,$right)', (fact) => {
    expect(isGloballyEligible(fact)).toBe(false)
  })
})

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0)
    if (delta !== 0) return delta
  }
  return 0
}
