import { describe, it, expect } from 'vitest'
import {
  finiteCoverageUniverses,
  coverageUniverse,
  calculateBlockCoverage,
  calculateConceptCoverage,
} from '@rosie/calc'
import type { CalcProblemState } from '@rosie/core'

function makeState(overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    signature: 'add(1,2)',
    level: 1,
    proficiency: 0,
    attemptCount: 0,
    appearanceCount: 0,
    recentResults: [],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('finite universe sizes', () => {
  const universes = finiteCoverageUniverses()

  it('add:10 has 45 ordered pairs', () => {
    const u = coverageUniverse('add:10')!
    expect(u.size).toBe(45)
  })

  it('sub:10 has 45 ordered pairs', () => {
    const u = coverageUniverse('sub:10')!
    expect(u.size).toBe(45)
  })

  it('mul:29 has 64 ordered pairs', () => {
    const u = coverageUniverse('mul:29')!
    expect(u.size).toBe(64)
  })

  it('div:29 has 64 ordered pairs', () => {
    const u = coverageUniverse('div:29')!
    expect(u.size).toBe(64)
  })

  it('all universes have consistent version', () => {
    for (const u of universes) {
      expect(u.version).toBe('v1')
    }
  })
})

describe('signature bijection', () => {
  it('indexOf(signatureAt(i)) === i for all universes', () => {
    for (const u of finiteCoverageUniverses()) {
      for (let i = 0; i < u.size; i++) {
        const sig = u.signatureAt(i)
        expect(u.indexOf(sig)).toBe(i)
      }
    }
  })

  it('no duplicate signatures within any universe', () => {
    for (const u of finiteCoverageUniverses()) {
      const seen = new Set<string>()
      for (let i = 0; i < u.size; i++) {
        const sig = u.signatureAt(i)
        expect(seen.has(sig)).toBe(false)
        seen.add(sig)
      }
    }
  })
})

describe('classify completeness', () => {
  it('every signature classifies to at least one family', () => {
    for (const u of finiteCoverageUniverses()) {
      for (let i = 0; i < u.size; i++) {
        const sig = u.signatureAt(i)
        const families = u.classify(sig)
        expect(families.length).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('calculateBlockCoverage', () => {
  it('empty states yields all uncovered', () => {
    const u = coverageUniverse('add:10')!
    const result = calculateBlockCoverage(u, new Map())
    expect(result.total).toBe(45)
    expect(result.covered).toBe(0)
    expect(result.missingSignatures).toHaveLength(45)
  })

  it('practiced signatures are covered', () => {
    const u = coverageUniverse('add:10')!
    const sig = u.signatureAt(0)
    const states = new Map<string, CalcProblemState>([
      [sig, makeState({ signature: sig, appearanceCount: 3 })],
    ])
    const result = calculateBlockCoverage(u, states)
    expect(result.covered).toBe(1)
    expect(result.missingSignatures).toHaveLength(44)
  })
})

describe('calculateConceptCoverage', () => {
  it('merges commutative pairs into single concepts for add:10', () => {
    const u = coverageUniverse('add:10')!
    const result = calculateConceptCoverage(u, new Map())
    // add:10 has 45 ordered pairs; commutative normalization reduces them
    // a+b where a,b >= 1 and a+b <= 10: pairs like (1,2) and (2,1) merge
    expect(result.totalConcepts).toBeLessThan(45)
    expect(result.totalConcepts).toBeGreaterThan(0)
  })

  it('sub:10 has same concept count as signature count (non-commutative)', () => {
    const u = coverageUniverse('sub:10')!
    const result = calculateConceptCoverage(u, new Map())
    expect(result.totalConcepts).toBe(45)
  })

  it('concept coverage counts best evidence per concept', () => {
    const u = coverageUniverse('add:10')!
    // add(1,2) is practiced, add(2,1) is not
    const sig1 = 'add(1,2)'
    const states = new Map<string, CalcProblemState>([
      [sig1, makeState({ signature: sig1, appearanceCount: 2 })],
    ])
    const result = calculateConceptCoverage(u, states)
    expect(result.coveredConcepts).toBe(1)
    expect(result.totalConcepts).toBeLessThan(45)
  })
})
