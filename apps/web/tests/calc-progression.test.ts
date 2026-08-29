import { describe, it, expect } from 'vitest'
import {
  evaluateBlockProgression,
  blockTierFromProgression,
  mixingStageFromProgression,
  determineMixingStage,
  progressionFactor,
  recoverySessionCount,
  MIXING_STAGES,
  type BlockProgression,
} from '@rosie/calc'
import type { CalcProblemState, CalcSession, QuestionAttempt } from '@rosie/core'

function makeProgression(overrides: Partial<BlockProgression> = {}): BlockProgression {
  return {
    blockId: 'add:10',
    exposure: 0,
    recentAccuracy: 0,
    stableRatio: 0,
    fluentRatio: 0,
    reviewDueRatio: 0,
    masteredRatio: 0,
    stableCount: 0,
    fluentCount: 0,
    evaluatedCount: 0,
    coveredCount: 0,
    coverageTotal: 0,
    accuracyCorrect: 0,
    accuracyTotal: 0,
    ready: false,
    recovery: false,
    reasons: [],
    ...overrides,
  }
}

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

function okAttempt(sessionNo: number, date: string): QuestionAttempt {
  return {
    correct: true,
    timeMs: 1200,
    withinLimit: true,
    evidenceKind: 'independent',
    sessionNo,
    date,
  }
}

describe('blockTierFromProgression', () => {
  it('defaults to entry', () => {
    expect(blockTierFromProgression(makeProgression())).toBe('entry')
  })

  it('stable requires exposure ≥ 0.8 and stableRatio ≥ 0.7', () => {
    expect(
      blockTierFromProgression(makeProgression({ exposure: 0.8, stableRatio: 0.7 })),
    ).toBe('stable')
    expect(
      blockTierFromProgression(makeProgression({ exposure: 0.79, stableRatio: 0.7 })),
    ).toBe('entry')
    expect(
      blockTierFromProgression(makeProgression({ exposure: 0.8, stableRatio: 0.69 })),
    ).toBe('entry')
  })

  it('fluent requires exposure ≥ 0.9, stableRatio ≥ 0.8, fluentRatio ≥ 0.6', () => {
    expect(
      blockTierFromProgression(
        makeProgression({ exposure: 0.9, stableRatio: 0.8, fluentRatio: 0.6 }),
      ),
    ).toBe('fluent')
    expect(
      blockTierFromProgression(
        makeProgression({ exposure: 0.9, stableRatio: 0.8, fluentRatio: 0.59 }),
      ),
    ).toBe('stable')
  })

  it('auto requires full exposure, masteredRatio ≥ 0.9, fluentRatio ≥ 0.8', () => {
    expect(
      blockTierFromProgression(
        makeProgression({ exposure: 1, stableRatio: 1, fluentRatio: 0.8, masteredRatio: 0.9 }),
      ),
    ).toBe('auto')
    expect(
      blockTierFromProgression(
        makeProgression({ exposure: 0.99, stableRatio: 1, fluentRatio: 0.8, masteredRatio: 0.9 }),
      ),
    ).toBe('fluent')
    expect(
      blockTierFromProgression(
        makeProgression({ exposure: 1, stableRatio: 1, fluentRatio: 0.8, masteredRatio: 0.89 }),
      ),
    ).toBe('fluent')
  })
})

describe('MIXING_STAGES ratios', () => {
  it('encodes the documented 70/20/10 → 60/20/20 → 50/20/30 evolution', () => {
    expect(MIXING_STAGES.initial).toEqual({
      currentMaintenance: 0.7,
      nextExploration: 0.2,
      weakReinforcement: 0.1,
    })
    expect(MIXING_STAGES.stabilized).toEqual({
      currentMaintenance: 0.6,
      nextExploration: 0.2,
      weakReinforcement: 0.2,
    })
    expect(MIXING_STAGES.graduated).toEqual({
      currentMaintenance: 0.5,
      nextExploration: 0.2,
      weakReinforcement: 0.3,
    })
  })

  it('every stage sums to 1', () => {
    for (const ratios of Object.values(MIXING_STAGES)) {
      const sum = ratios.currentMaintenance + ratios.nextExploration + ratios.weakReinforcement
      expect(sum).toBeCloseTo(1, 10)
    }
  })
})

describe('mixingStageFromProgression', () => {
  it('entry tier stays initial even with high accuracy', () => {
    expect(
      mixingStageFromProgression(makeProgression({ recentAccuracy: 0.95 })),
    ).toBe('initial')
  })

  it('stable tier + recent accuracy ≥ 0.8 → stabilized', () => {
    expect(
      mixingStageFromProgression(
        makeProgression({ exposure: 0.8, stableRatio: 0.7, recentAccuracy: 0.8 }),
      ),
    ).toBe('stabilized')
  })

  it('stable tier but accuracy < 0.8 stays initial', () => {
    expect(
      mixingStageFromProgression(
        makeProgression({ exposure: 0.8, stableRatio: 0.7, recentAccuracy: 0.79 }),
      ),
    ).toBe('initial')
  })

  it('fluent tier + masteredRatio ≥ 0.6 → graduated', () => {
    expect(
      mixingStageFromProgression(
        makeProgression({
          exposure: 0.9,
          stableRatio: 0.8,
          fluentRatio: 0.6,
          masteredRatio: 0.6,
          recentAccuracy: 0.9,
        }),
      ),
    ).toBe('graduated')
  })

  it('fluent tier without enough mastery falls back to stabilized', () => {
    expect(
      mixingStageFromProgression(
        makeProgression({
          exposure: 0.9,
          stableRatio: 0.8,
          fluentRatio: 0.6,
          masteredRatio: 0.5,
          recentAccuracy: 0.9,
        }),
      ),
    ).toBe('stabilized')
  })
})

describe('evaluateBlockProgression', () => {
  it('empty states yields zero exposure and entry tier', () => {
    const p = evaluateBlockProgression('add:10', new Map())
    expect(p.exposure).toBe(0)
    expect(p.masteredRatio).toBe(0)
    expect(blockTierFromProgression(p)).toBe('entry')
  })

  it('computes exposure from covered universe signatures', () => {
    const states = new Map<string, CalcProblemState>([
      [
        'add(1,2)',
        makeState({
          signature: 'add(1,2)',
          blockId: 'add:10',
          appearanceCount: 1,
          recentResults: [okAttempt(1, '2026-01-01')],
        }),
      ],
    ])
    const p = evaluateBlockProgression('add:10', states)
    expect(p.coveredCount).toBe(1)
    expect(p.coverageTotal).toBe(45)
    expect(p.exposure).toBeCloseTo(1 / 45, 10)
  })

  it('masteredRatio counts only states whose evidence reaches mastered', () => {
    const mastered = makeState({
      signature: 'add(1,2)',
      blockId: 'add:10',
      appearanceCount: 3,
      proficiency: 5,
      status: 'mastered',
      recentResults: [
        okAttempt(1, '2026-01-01'),
        okAttempt(2, '2026-01-02'),
        okAttempt(2, '2026-01-02'),
      ],
    })
    const learning = makeState({
      signature: 'add(1,3)',
      blockId: 'add:10',
      appearanceCount: 1,
      recentResults: [okAttempt(1, '2026-01-01')],
    })
    const states = new Map<string, CalcProblemState>([
      [mastered.signature, mastered],
      [learning.signature, learning],
    ])
    const p = evaluateBlockProgression('add:10', states)
    expect(p.masteredRatio).toBe(0.5)
  })

  it('accuracy ignores makeup and recall attempts', () => {
    const state = makeState({
      signature: 'add(1,2)',
      blockId: 'add:10',
      appearanceCount: 3,
      recentResults: [
        { correct: false, timeMs: 900, evidenceKind: 'independent', sessionNo: 1, date: '2026-01-01' },
        { correct: true, timeMs: 900, evidenceKind: 'makeup', sessionNo: 1, date: '2026-01-01' },
        { correct: true, timeMs: 900, evidenceKind: 'recall', sessionNo: 1, date: '2026-01-01' },
      ],
    })
    const states = new Map<string, CalcProblemState>([[state.signature, state]])
    const p = evaluateBlockProgression('add:10', states)
    expect(p.accuracyTotal).toBe(1)
    expect(p.accuracyCorrect).toBe(0)
    expect(p.recentAccuracy).toBe(0)
  })
})

describe('determineMixingStage', () => {
  it('empty states → initial', () => {
    expect(determineMixingStage('add:10', new Map())).toBe('initial')
  })
})

function makeSession(
  finishedAt: string,
  blockId: string,
  total: number,
  correct: number,
): CalcSession {
  const questionLog = Array.from({ length: total }, (_, i) => ({
    key: `block:${blockId}`,
    ms: 1000,
    ok: i < correct,
  }))
  return {
    date: finishedAt.slice(0, 10),
    startedAt: finishedAt,
    finishedAt,
    count: total,
    correctCount: correct,
    retryCount: 0,
    wrongCount: total - correct,
    challengeCorrect: 0,
    timeSpentSec: 60,
    coinsEarned: 0,
    mode: 'daily',
    maxStreak: 0,
    topLevel: 1,
    questionLog,
  }
}

describe('recoverySessionCount', () => {
  it('returns null when there is no recovery event in history', () => {
    const sessions = [
      makeSession('2026-01-03T10:00:00Z', 'add:10', 10, 9),
      makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 10),
    ]
    expect(recoverySessionCount('add:10', sessions)).toBeNull()
  })

  it('counts consecutive normal sessions since the last recovery session', () => {
    const sessions = [
      makeSession('2026-01-04T10:00:00Z', 'add:10', 10, 8),
      makeSession('2026-01-03T10:00:00Z', 'add:10', 10, 9),
      makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 3), // recovery: 30% < 70%
      makeSession('2026-01-01T10:00:00Z', 'add:10', 10, 10),
    ]
    expect(recoverySessionCount('add:10', sessions)).toBe(2)
  })

  it('returns 0 when the most recent session is itself a recovery session', () => {
    const sessions = [makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 2)]
    expect(recoverySessionCount('add:10', sessions)).toBe(0)
  })

  it('ignores sessions that do not contain the block', () => {
    const sessions = [
      makeSession('2026-01-04T10:00:00Z', 'add:10', 10, 9),
      makeSession('2026-01-03T10:00:00Z', 'mul:29', 10, 1), // other block, skipped
      makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 2), // recovery
    ]
    expect(recoverySessionCount('add:10', sessions)).toBe(1)
  })
})

describe('progressionFactor debounce', () => {
  it('returns 0.1 while a dependency is actively in recovery', () => {
    const bad = makeState({
      signature: 'add(1,2)',
      blockId: 'add:10',
      appearanceCount: 3,
      recentResults: [
        { correct: false, timeMs: 900, evidenceKind: 'independent', sessionNo: 5, date: '2026-01-05' },
        { correct: false, timeMs: 900, evidenceKind: 'independent', sessionNo: 5, date: '2026-01-05' },
        { correct: false, timeMs: 900, evidenceKind: 'independent', sessionNo: 5, date: '2026-01-05' },
      ],
    })
    const states = new Map<string, CalcProblemState>([[bad.signature, bad]])
    expect(progressionFactor('add:20a', states, [])).toBe(0.1)
  })

  it('applies the 0.5 cooldown when a dependency just recovered (<2 normal sessions)', () => {
    const sessions = [
      makeSession('2026-01-03T10:00:00Z', 'add:10', 10, 8),
      makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 3), // recovery event
    ]
    expect(progressionFactor('add:20a', new Map(), sessions)).toBe(0.5)
  })

  it('restores the readiness-based factor once recovered for ≥2 sessions', () => {
    const sessions = [
      makeSession('2026-01-04T10:00:00Z', 'add:10', 10, 9),
      makeSession('2026-01-03T10:00:00Z', 'add:10', 10, 8),
      makeSession('2026-01-02T10:00:00Z', 'add:10', 10, 3), // recovery event
    ]
    // No states → dependency not ready → falls through to 0.2, not the cooldown.
    expect(progressionFactor('add:20a', new Map(), sessions)).toBe(0.2)
  })

  it('ignores session history when it is absent', () => {
    expect(progressionFactor('add:20a', new Map())).toBe(0.2)
  })
})
