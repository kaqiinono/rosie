import { describe, it, expect } from 'vitest'
import {
  attemptRowHasViewableCanvas,
  pickPracticeAttemptForRow,
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

type MiniAttempt = {
  id: string
  correct: boolean | null
  attemptedAt: string
  objects?: { type: string }[]
  draftId?: string | null
  paperId?: string | null
}

describe('pickPracticeAttemptForRow', () => {
  const attempt = (partial: MiniAttempt): MiniAttempt => ({
    objects: [],
    draftId: null,
    paperId: null,
    ...partial,
  })

  it('returns null when there are no practice attempts', () => {
    expect(pickPracticeAttemptForRow([], '2026-08-04T10:00:00.000Z', false)).toBeNull()
  })

  it('binds the row to the time-matched attempt even without canvas', () => {
    const matched = attempt({
      id: 'match',
      correct: true,
      attemptedAt: '2026-08-04T12:00:00.000Z',
      objects: [],
    })
    const otherWithCanvas = attempt({
      id: 'other',
      correct: true,
      attemptedAt: '2026-08-01T10:00:00.000Z',
      objects: [{ type: 'stroke' }],
    })
    const picked = pickPracticeAttemptForRow(
      [matched, otherWithCanvas],
      '2026-08-04T12:05:00.000Z',
      false,
    )
    expect(picked?.id).toBe('match')
    expect(attemptRowHasViewableCanvas(picked!)).toBe(false)
  })

  it('does not substitute another attempt that has a draft', () => {
    const thisPractice = attempt({
      id: 'this',
      correct: true,
      attemptedAt: '2026-08-04T10:00:00.000Z',
    })
    const olderDraft = attempt({
      id: 'older-draft',
      correct: false,
      attemptedAt: '2026-08-03T10:00:00.000Z',
      objects: [{ type: 'stroke' }],
    })
    const picked = pickPracticeAttemptForRow(
      [thisPractice, olderDraft],
      '2026-08-04T10:00:00.000Z',
      false,
    )
    expect(picked?.id).toBe('this')
  })

  it('when preferWrong, picks the wrong attempt for this practice window', () => {
    const wrong = attempt({
      id: 'wrong',
      correct: false,
      attemptedAt: '2026-08-04T09:00:00.000Z',
      objects: [{ type: 'stroke' }],
    })
    const correct = attempt({
      id: 'ok',
      correct: true,
      attemptedAt: '2026-08-04T11:00:00.000Z',
      objects: [{ type: 'stroke' }],
    })
    const picked = pickPracticeAttemptForRow([correct, wrong], '2026-08-04T09:00:00.000Z', true)
    expect(picked?.id).toBe('wrong')
  })

  it('ignores quiz paper attempts', () => {
    const quiz = attempt({
      id: 'quiz',
      correct: true,
      attemptedAt: '2026-08-04T12:00:00.000Z',
      paperId: 'paper-1',
      objects: [{ type: 'stroke' }],
    })
    const practice = attempt({
      id: 'practice',
      correct: true,
      attemptedAt: '2026-08-04T11:00:00.000Z',
      objects: [{ type: 'stroke' }],
    })
    const picked = pickPracticeAttemptForRow([quiz, practice], '2026-08-04T12:00:00.000Z', false)
    expect(picked?.id).toBe('practice')
  })
})

describe('attemptRowHasViewableCanvas', () => {
  it('is true for non-empty objects or draftId', () => {
    expect(attemptRowHasViewableCanvas({ objects: [{ type: 'x' } as never] })).toBe(true)
    expect(attemptRowHasViewableCanvas({ objects: [], draftId: 'd1' })).toBe(true)
    expect(attemptRowHasViewableCanvas({ objects: [], draftId: null })).toBe(false)
  })
})
