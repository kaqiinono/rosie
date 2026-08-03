import { describe, expect, it } from 'vitest'
import {
  resolveChinesePlanCreateStatus,
  currentBatchLessonKeys,
  isLessonCompleteForPlan,
} from '@rosie/chinese'

describe('resolveChinesePlanCreateStatus', () => {
  it('active when none active', () => {
    expect(resolveChinesePlanCreateStatus(false)).toBe('active')
  })
  it('paused when another active', () => {
    expect(resolveChinesePlanCreateStatus(true)).toBe('paused')
  })
})

describe('currentBatchLessonKeys', () => {
  const ordered = ['a', 'b', 'c', 'd']
  it('returns K lessons from current, skipping completed before current', () => {
    expect(currentBatchLessonKeys(ordered, 'b', 2, new Set(['a']))).toEqual(['b', 'c'])
  })
  it('stops at end of book', () => {
    expect(currentBatchLessonKeys(ordered, 'd', 3, new Set(['a', 'b', 'c']))).toEqual(['d'])
  })
})

describe('isLessonCompleteForPlan', () => {
  it('normal lesson: all present plan quiz types done; missing types ignored', () => {
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'lesson',
        planQuizTypes: ['recognize', 'stroke', 'passage'],
        presentPhases: ['recognize', 'stroke'], // no passage content
        finishedPhases: ['recognize', 'stroke'],
      }),
    ).toBe(true)
  })
  it('garden: empty plan types do not complete; needs poems/accumulation if present', () => {
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'garden',
        planQuizTypes: ['recognize', 'stroke'],
        presentPhases: ['poems', 'accumulation'],
        finishedPhases: [],
      }),
    ).toBe(false)
    expect(
      isLessonCompleteForPlan({
        lessonKind: 'garden',
        planQuizTypes: ['recognize', 'stroke'],
        presentPhases: ['poems', 'accumulation'],
        finishedPhases: ['poems', 'accumulation'],
      }),
    ).toBe(true)
  })
})
