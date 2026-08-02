import { describe, it, expect, beforeEach } from 'vitest'
import {
  ADAPTIVE_PENDING_KIND,
  ADAPTIVE_SESSION_SNAPSHOT_VERSION,
  clearAdaptiveSessionSnapshot,
  readAdaptiveSessionSnapshot,
  writeAdaptiveSessionSnapshot,
  type AdaptiveSessionSnapshot,
} from '../../../packages/english/src/utils/adaptivePlanSessionSnapshot'
import { practicePendingLocalKey, todayStr } from '../../../packages/core/src/index'

const PLAN_ID = 'plan-1'
const TODAY = todayStr()
const STORAGE_KEY = practicePendingLocalKey(ADAPTIVE_PENDING_KIND, PLAN_ID)

function snapshot(overrides: Partial<AdaptiveSessionSnapshot> = {}): AdaptiveSessionSnapshot {
  return {
    version: ADAPTIVE_SESSION_SNAPSHOT_VERSION,
    planId: PLAN_ID,
    date: TODAY,
    phase: 'review',
    quizSlots: [{ key: 'U1::L1::cat', type: 'A' }],
    curQ: 0,
    score: 0,
    reviewCursor: 1,
    reviewDoneKeys: [],
    studyIdx: 0,
    activationApplied: false,
    newStudyDone: 0,
    starsAwarded: 0,
    roundActivateKeys: ['U1::L1::dog'],
    roundReviewKeys: ['U1::L1::cat'],
    reviewOutcomes: [{ wordKey: 'U1::L1::cat', correct: true }],
    finalOutcomes: [],
    bossFirstPassOutcomes: [],
    bossSinkOutcomes: [],
    finalPassWrongKeys: [],
    bossPassWrongKeys: [],
    bossSinkWrongKeys: [],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('adaptive plan session snapshot', () => {
  it('round-trips write → read', () => {
    writeAdaptiveSessionSnapshot(snapshot())
    const restored = readAdaptiveSessionSnapshot(PLAN_ID, TODAY)
    expect(restored).not.toBeNull()
    expect(restored!.phase).toBe('review')
    expect(restored!.roundActivateKeys).toEqual(['U1::L1::dog'])
    expect(restored!.reviewOutcomes).toEqual([{ wordKey: 'U1::L1::cat', correct: true }])
  })

  it('discards stale-day snapshots and removes them from storage', () => {
    writeAdaptiveSessionSnapshot(snapshot())
    expect(readAdaptiveSessionSnapshot(PLAN_ID, '2026-07-09')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards version mismatches', () => {
    writeAdaptiveSessionSnapshot(snapshot({ version: 999 }))
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
  })

  it('discards invalid phases and corrupt JSON', () => {
    writeAdaptiveSessionSnapshot(
      snapshot({ phase: 'done' as unknown as AdaptiveSessionSnapshot['phase'] }),
    )
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()

    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns null for missing snapshots and clears cleanly', () => {
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
    writeAdaptiveSessionSnapshot(snapshot())
    clearAdaptiveSessionSnapshot(PLAN_ID)
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
  })

  it('does not resurrect a snapshot for a different plan', () => {
    writeAdaptiveSessionSnapshot(snapshot())
    expect(readAdaptiveSessionSnapshot('plan-2', TODAY)).toBeNull()
  })
})
