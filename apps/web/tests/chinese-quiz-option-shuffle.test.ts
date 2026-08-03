import { describe, expect, it } from 'vitest'
import { hashSeed, shuffle } from '../../../packages/chinese/src/utils/chinese-helpers'

describe('hashSeed + shuffle option positions', () => {
  it('keeps uint32 seeds for long practice ids (no Infinity → 0)', () => {
    const id = 'g2a::u1-l1::blank::char::0'
    const broken =
      (id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 13) >>> 0)
    expect(broken).toBe(0)

    const seed = hashSeed(id, 13)
    expect(seed).not.toBe(0)
    expect(Number.isFinite(seed)).toBe(true)
  })

  it('does not pin the first element to D for long-id seeds', () => {
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 200; i++) {
      const seed = hashSeed(`g2a::u1-l1::blank::char::${i}`, 13)
      const opts = shuffle(['CORRECT', 'a', 'b', 'c'], seed + 1)
      counts[opts.indexOf('CORRECT')]++
    }
    // Broken float-hash put 100% at index 3; fixed should spread.
    expect(counts[3]).toBeLessThan(120)
    expect(counts[0] + counts[1] + counts[2]).toBeGreaterThan(50)
  })
})
