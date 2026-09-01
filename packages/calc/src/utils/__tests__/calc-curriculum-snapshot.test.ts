import { describe, expect, it } from 'vitest'
import type { CalcProblemState } from '@rosie/core'
import {
  decodeSnapshotBits,
  snapshotMutationItems,
  type CurriculumSnapshot,
} from '../calc-curriculum-snapshot'
import { calculateBlockCoverage, coverageUniverse } from '../calc-coverage'

function state(signature: string, overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    signature,
    level: 1,
    proficiency: 0,
    attemptCount: 1,
    appearanceCount: 1,
    recentResults: [
      {
        correct: true,
        timeMs: 900,
        withinLimit: true,
        evidenceKind: 'independent',
        sessionNo: 1,
        date: '2026-08-31',
      },
    ],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 1,
    lastWithinLimit: true,
    updatedAt: '2026-08-31T00:00:00.000Z',
    blockId: 'add:10',
    ...overrides,
  }
}

describe('compact curriculum snapshots', () => {
  it('decodes PostgreSQL bytea bits from the least-significant bit of each byte', () => {
    expect([...decodeSnapshotBits('\\x8181', 16)]).toEqual([0, 7, 8, 15])
    expect([...decodeSnapshotBits('\\x07', 3)]).toEqual([0, 1, 2])
  })

  it('derives snapshot mutations only for registered finite formulas', () => {
    const items = snapshotMutationItems([state('add(1,1)')])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      block_id: 'add:10',
      curriculum_version: 'v1',
      curriculum_index: 0,
      covered: true,
      within_target: true,
      fluent: false,
      mastered: false,
    })
    expect(snapshotMutationItems([state('add(1000,1000)', { blockId: 'add:10000' })])).toEqual([])
  })

  it('uses compact history when a formula has no hot state', () => {
    const universe = coverageUniverse('add:10')!
    const snapshot: CurriculumSnapshot = {
      blockId: universe.blockId,
      version: universe.version,
      universeSize: universe.size,
      covered: new Set([0]),
      withinTarget: new Set([0]),
      fluent: new Set([0]),
      mastered: new Set(),
      updatedAt: '2026-08-31T00:00:00.000Z',
    }
    const result = calculateBlockCoverage(universe, new Map(), snapshot)
    expect(result.covered).toBe(1)
    expect(result.withinTarget).toBe(1)
    expect(result.fluent).toBe(1)
    expect(result.missingSignatures).not.toContain(universe.signatureAt(0))
  })

  it('lets a newer hot regression override the old fluent/mastered snapshot', () => {
    const universe = coverageUniverse('add:10')!
    const signature = universe.signatureAt(0)
    const snapshot: CurriculumSnapshot = {
      blockId: universe.blockId,
      version: universe.version,
      universeSize: universe.size,
      covered: new Set([0]),
      withinTarget: new Set([0]),
      fluent: new Set([0]),
      mastered: new Set([0]),
      updatedAt: '2026-08-30T00:00:00.000Z',
    }
    const regressed = state(signature, {
      proficiency: 3,
      status: 'lagging',
      consecutiveWrong: 1,
      recentResults: [
        {
          correct: false,
          timeMs: 5000,
          withinLimit: false,
          evidenceKind: 'independent',
          sessionNo: 2,
          date: '2026-08-31',
        },
      ],
    })
    const result = calculateBlockCoverage(universe, new Map([[signature, regressed]]), snapshot)
    expect(result.covered).toBe(1)
    expect(result.fluent).toBe(0)
    expect(result.mastered).toBe(0)
    expect(result.reviewDue).toBe(1)
  })
})
