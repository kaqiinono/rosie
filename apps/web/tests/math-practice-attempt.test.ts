import { describe, it, expect } from 'vitest'
import {
  resolveAttemptCanvasObjects,
  shouldInsertCompletedWithoutInProgress,
} from '../../../packages/math/src/utils/math-practice-attempt'

describe('resolveAttemptCanvasObjects', () => {
  it('prefers attempt.objects when non-empty', () => {
    const stroke = [{ type: 'stroke', points: [] }] as never
    expect(
      resolveAttemptCanvasObjects({ objects: stroke, draftId: 'd1' }, [{ type: 'stroke', points: [1] }] as never),
    ).toEqual(stroke)
  })

  it('falls back to draft objects when attempt.objects empty', () => {
    const draft = [{ type: 'stroke', points: [1] }] as never
    expect(resolveAttemptCanvasObjects({ objects: [], draftId: 'd1' }, draft)).toEqual(draft)
  })

  it('returns empty when both empty', () => {
    expect(resolveAttemptCanvasObjects({ objects: [] }, null)).toEqual([])
  })
})

// math_wrong upsert + mathWrongStore patch live in submitPracticeAttempt (not covered here).

describe('shouldInsertCompletedWithoutInProgress', () => {
  it('is true when no in-progress row', () => {
    expect(shouldInsertCompletedWithoutInProgress(false)).toBe(true)
  })
  it('is false when in-progress exists', () => {
    expect(shouldInsertCompletedWithoutInProgress(true)).toBe(false)
  })
})
