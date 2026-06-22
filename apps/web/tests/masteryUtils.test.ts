import { describe, it, expect } from 'vitest'
import {
  ensureStageInit,
  advanceStage,
  regressStage,
  isGraduated,
  getWordMasteryLevel,
  getMasteryLevel,
  hashOffset,
  GRADUATED_STAGE_NORMAL,
  GRADUATED_STAGE_HARD,
  NORMAL_INTERVALS,
  HARD_INTERVALS,
} from '@rosie/core'
import type { WordMasteryInfo } from '@rosie/core'

const TODAY = '2026-05-29'

const base = (overrides: Partial<WordMasteryInfo> = {}): WordMasteryInfo => ({
  correct: 0,
  incorrect: 0,
  lastSeen: '',
  ...overrides,
})

describe('ensureStageInit', () => {
  it('returns input unchanged when stage already defined', () => {
    const info = base({ stage: 4, isHard: true, nextReviewDate: '2026-06-01' })
    expect(ensureStageInit(info, TODAY)).toBe(info)
  })

  it('initialises stage 0 for never-seen word', () => {
    const out = ensureStageInit(base(), TODAY)
    expect(out.stage).toBe(0)
    expect(out.isHard).toBe(false)
  })

  it('infers stage from correct count (1 → 1, 3 → 2, 5 → 3)', () => {
    expect(ensureStageInit(base({ correct: 1 }), TODAY).stage).toBe(1)
    expect(ensureStageInit(base({ correct: 3 }), TODAY).stage).toBe(2)
    expect(ensureStageInit(base({ correct: 5 }), TODAY).stage).toBe(3)
  })

  it('marks as hard when incorrect ≥ 2', () => {
    expect(ensureStageInit(base({ incorrect: 2 }), TODAY).isHard).toBe(true)
  })

  it('marks as hard when incorrect exceeds correct', () => {
    expect(ensureStageInit(base({ correct: 1, incorrect: 2 }), TODAY).isHard).toBe(true)
    expect(ensureStageInit(base({ correct: 5, incorrect: 1 }), TODAY).isHard).toBe(false)
  })
})

describe('advanceStage', () => {
  it('advances stage 0 → 1', () => {
    const out = advanceStage(base({ stage: 0, isHard: false }), TODAY)
    expect(out.stage).toBe(1)
    expect(out.nextReviewDate).toBeDefined()
  })

  it('caps at graduated for normal track (7) and clears nextReviewDate', () => {
    const out = advanceStage(base({ stage: GRADUATED_STAGE_NORMAL - 1, isHard: false }), TODAY)
    expect(out.stage).toBe(GRADUATED_STAGE_NORMAL)
    expect(out.nextReviewDate).toBeUndefined()
  })

  it('caps at graduated for hard track (8)', () => {
    const out = advanceStage(base({ stage: GRADUATED_STAGE_HARD - 1, isHard: true }), TODAY)
    expect(out.stage).toBe(GRADUATED_STAGE_HARD)
    expect(out.nextReviewDate).toBeUndefined()
  })

  it('hard track has different intervals than normal', () => {
    expect(HARD_INTERVALS).not.toEqual(NORMAL_INTERVALS)
  })

  it('per-word offset is deterministic for the same key', () => {
    expect(hashOffset('cat')).toBe(hashOffset('cat'))
    expect(hashOffset('cat', 3)).toBeGreaterThanOrEqual(0)
    expect(hashOffset('cat', 3)).toBeLessThan(3)
  })
})

describe('regressStage', () => {
  it('keeps stage 0 at 0 and marks hard', () => {
    const out = regressStage(base({ stage: 0, isHard: false }), TODAY)
    expect(out.stage).toBe(0)
    expect(out.isHard).toBe(true)
  })

  it('drops stage 1 to 0', () => {
    expect(regressStage(base({ stage: 1, isHard: false }), TODAY).stage).toBe(0)
  })

  it('drops stages 2-4 to 1', () => {
    expect(regressStage(base({ stage: 2 }), TODAY).stage).toBe(1)
    expect(regressStage(base({ stage: 3 }), TODAY).stage).toBe(1)
    expect(regressStage(base({ stage: 4 }), TODAY).stage).toBe(1)
  })

  it('drops stages ≥ 5 to 3', () => {
    expect(regressStage(base({ stage: 5 }), TODAY).stage).toBe(3)
    expect(regressStage(base({ stage: 7 }), TODAY).stage).toBe(3)
  })
})

describe('isGraduated', () => {
  it('uninitialised → false', () => {
    expect(isGraduated(base())).toBe(false)
  })

  it('normal track graduates at stage 7', () => {
    expect(isGraduated(base({ stage: 6, isHard: false }))).toBe(false)
    expect(isGraduated(base({ stage: 7, isHard: false }))).toBe(true)
  })

  it('hard track graduates at stage 8', () => {
    expect(isGraduated(base({ stage: 7, isHard: true }))).toBe(false)
    expect(isGraduated(base({ stage: 8, isHard: true }))).toBe(true)
  })
})

describe('getWordMasteryLevel', () => {
  it('maps correct-count to 0–3 with English thresholds', () => {
    expect(getWordMasteryLevel(0)).toBe(0)
    expect(getWordMasteryLevel(1)).toBe(1)
    expect(getWordMasteryLevel(3)).toBe(1)
    expect(getWordMasteryLevel(4)).toBe(2)
    expect(getWordMasteryLevel(8)).toBe(2)
    expect(getWordMasteryLevel(9)).toBe(3)
    expect(getWordMasteryLevel(20)).toBe(3)
  })
})

describe('getMasteryLevel (math thresholds)', () => {
  it('maps correct-count to 0–3', () => {
    expect(getMasteryLevel(0)).toBe(0)
    expect(getMasteryLevel(1)).toBe(1)
    expect(getMasteryLevel(2)).toBe(2)
    expect(getMasteryLevel(3)).toBe(3)
    expect(getMasteryLevel(99)).toBe(3)
  })
})
