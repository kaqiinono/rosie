import { describe, it, expect, beforeEach } from 'vitest'
import {
  ADAPTIVE_SESSION_SNAPSHOT_VERSION,
  adaptiveSessionStorageKey,
  clearAdaptiveSessionSnapshot,
  readAdaptiveSessionSnapshot,
  writeAdaptiveSessionSnapshot,
  type AdaptiveSessionSnapshot,
} from '../../../packages/english/src/utils/adaptivePlanSessionSnapshot'

const TODAY = '2026-07-10'
const PLAN_ID = 'plan-1'

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
  sessionStorage.clear()
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
    writeAdaptiveSessionSnapshot(snapshot({ date: '2026-07-09' }))
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
    expect(sessionStorage.getItem(adaptiveSessionStorageKey(PLAN_ID))).toBeNull()
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

    sessionStorage.setItem(adaptiveSessionStorageKey(PLAN_ID), '{not json')
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
  })

  it('returns null for missing snapshots and clears cleanly', () => {
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
    writeAdaptiveSessionSnapshot(snapshot())
    clearAdaptiveSessionSnapshot(PLAN_ID)
    expect(readAdaptiveSessionSnapshot(PLAN_ID, TODAY)).toBeNull()
  })
})
