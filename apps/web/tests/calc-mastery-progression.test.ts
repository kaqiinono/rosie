import { describe, expect, it } from 'vitest'
import type { CalcProblemState, QuestionAttempt } from '@rosie/core'
import {
  applyAttempt,
  defaultProblemState,
} from '../../../packages/calc/src/utils/calc-apply-attempt'
import { learningStatusOf, coverageUniverse } from '../../../packages/calc/src/utils/calc-coverage'
import { evaluateBlockProgression } from '../../../packages/calc/src/utils/calc-progression'
import { buildSession } from '../../../packages/calc/src/utils/calc-helpers'
import type { CalcSettings } from '@rosie/core'

function attempt(sessionNo: number, date: string): QuestionAttempt {
  return {
    correct: true,
    timeMs: 1500,
    withinLimit: true,
    sessionNo,
    date,
    evidenceKind: 'independent',
  }
}

describe('calc mastery v2', () => {
  it('does not let same-session make-up establish mastery', () => {
    let state = defaultProblemState('add(2,3)', 0)
    for (let index = 0; index < 5; index++) {
      state = applyAttempt(
        state,
        { correct: true, timeMs: 1000, evidenceKind: 'makeup' },
        true,
        1,
        '2026-08-29',
      )
    }
    expect(state.proficiency).toBe(0)
    expect(learningStatusOf(state)).toBe('learning')
  })

  it('requires fluent status followed by a later-day recall for mastery', () => {
    let state = defaultProblemState('add(2,3)', 0)
    state = applyAttempt(state, attempt(1, '2026-08-28'), true, 1, '2026-08-28')
    state = applyAttempt(state, attempt(2, '2026-08-28'), true, 2, '2026-08-28')
    state = applyAttempt(state, attempt(3, '2026-08-28'), true, 3, '2026-08-28')
    state = applyAttempt(
      state,
      { ...attempt(4, '2026-08-29'), evidenceKind: 'recall' },
      true,
      4,
      '2026-08-29',
    )
    expect(learningStatusOf(state)).toBe('mastered')
  })
})

describe('block progression', () => {
  it('only marks a block ready after coverage, accuracy and speed thresholds', () => {
    const universe = coverageUniverse('add:10')!
    const states = new Map<string, CalcProblemState>()
    for (let index = 0; index < universe.size; index++) {
      const signature = universe.signatureAt(index)
      states.set(signature, {
        ...defaultProblemState(signature, 0),
        blockId: 'add:10',
        appearanceCount: 3,
        attemptCount: 3,
        proficiency: 4,
        recentResults: [
          attempt(1, '2026-08-28'),
          attempt(2, '2026-08-28'),
          attempt(3, '2026-08-29'),
        ],
        status: 'mastered',
      })
    }
    const progress = evaluateBlockProgression('add:10', states)
    expect(progress.exposure).toBe(1)
    expect(progress.ready).toBe(true)
  })

  it('keeps expansion parent-controlled and uses a next-difficulty lane when ready', () => {
    const universe = coverageUniverse('add:10')!
    const states = new Map<string, CalcProblemState>()
    for (let index = 0; index < universe.size; index++) {
      const signature = universe.signatureAt(index)
      states.set(signature, {
        ...defaultProblemState(signature, 0),
        blockId: 'add:10',
        appearanceCount: 3,
        attemptCount: 3,
        proficiency: 4,
        recentResults: [
          attempt(1, '2026-08-28'),
          attempt(2, '2026-08-28'),
          attempt(3, '2026-08-29'),
        ],
        status: 'mastered',
      })
    }
    const settings: CalcSettings = {
      countMode: 'auto',
      selectedBlocks: [{ id: 'add:10', count: 20, seconds: 0 }],
      mixedOps: [],
      soundEnabled: false,
      includeInverse: false,
      verticalForBigNumbers: false,
      timedAnswerEnabled: false,
      immersiveMode: false,
      lastCount: 20,
      sessionCounter: 0,
      timingMode: 'relaxed',
      bonusSec: 0,
      autoSubmitOnMatch: true,
      adaptiveExpansionEnabled: true,
    }
    const expanded = buildSession(settings, { problemStates: states })
    expect(expanded.filter((question) => question.selectionReason === 'next-difficulty')).toHaveLength(4)
    const locked = buildSession(
      { ...settings, adaptiveExpansionEnabled: false },
      { problemStates: states },
    )
    expect(locked.some((question) => question.selectionReason === 'next-difficulty')).toBe(false)
  })

  it('shares the 20% exploration lane across multiple successors', () => {
    const universe = coverageUniverse('add:20b')!
    const states = new Map<string, CalcProblemState>()
    for (let index = 0; index < universe.size; index++) {
      const signature = universe.signatureAt(index)
      states.set(signature, {
        ...defaultProblemState(signature, 0),
        blockId: 'add:20b',
        appearanceCount: 3,
        attemptCount: 3,
        proficiency: 4,
        recentResults: [
          attempt(1, '2026-08-28'),
          attempt(2, '2026-08-28'),
          attempt(3, '2026-08-29'),
        ],
        status: 'mastered',
      })
    }
    const settings: CalcSettings = {
      countMode: 'auto',
      selectedBlocks: [{ id: 'add:20b', count: 20, seconds: 0 }],
      mixedOps: [],
      soundEnabled: false,
      includeInverse: false,
      verticalForBigNumbers: false,
      timedAnswerEnabled: false,
      immersiveMode: false,
      lastCount: 20,
      sessionCounter: 0,
      timingMode: 'relaxed',
      bonusSec: 0,
      autoSubmitOnMatch: true,
      adaptiveExpansionEnabled: true,
    }
    const expanded = buildSession(settings, { problemStates: states })
    const exploration = expanded.filter(
      (question) => question.selectionReason === 'next-difficulty',
    )
    expect(exploration).toHaveLength(4)
    expect(new Set(exploration.map((question) => question.sourceBlockId)).size).toBe(2)
  })
})
