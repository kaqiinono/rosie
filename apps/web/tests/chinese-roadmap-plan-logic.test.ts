import { describe, expect, it } from 'vitest'
import {
  CHINESE_PLAN_QUIZ_TYPES,
  resolveChinesePlanCreateStatus,
  currentBatchLessonKeys,
  isLessonCompleteForPlan,
  mapPlanRowToModel,
  type ChineseRoadmapPlanRow,
} from '@rosie/chinese'

function basePlanRow(overrides: Partial<ChineseRoadmapPlanRow> = {}): ChineseRoadmapPlanRow {
  return {
    id: 'p1',
    user_id: 'u1',
    title: 'Test',
    book_slug: 'g1b',
    start_lesson_key: 'g1b-l01',
    current_lesson_key: 'g1b-l01',
    lessons_per_batch: 1,
    quiz_types: null,
    status: 'active',
    completed_lesson_keys: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    ...overrides,
  }
}

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

describe('parseQuizTypes via mapPlanRowToModel', () => {
  it('null/undefined → default full set', () => {
    expect(mapPlanRowToModel(basePlanRow({ quiz_types: null })).quizTypes).toEqual([
      ...CHINESE_PLAN_QUIZ_TYPES,
    ])
    // absent column treated like undefined by callers passing undefined
    expect(
      mapPlanRowToModel(basePlanRow({ quiz_types: undefined as unknown as null })).quizTypes,
    ).toEqual([...CHINESE_PLAN_QUIZ_TYPES])
  })
  it('[] → []', () => {
    expect(mapPlanRowToModel(basePlanRow({ quiz_types: [] })).quizTypes).toEqual([])
  })
  it('unknown-only / blank → []', () => {
    expect(mapPlanRowToModel(basePlanRow({ quiz_types: ['blank'] })).quizTypes).toEqual([])
    expect(mapPlanRowToModel(basePlanRow({ quiz_types: ['nope', 'x'] })).quizTypes).toEqual([])
  })
  it('valid subset preserved', () => {
    expect(
      mapPlanRowToModel(basePlanRow({ quiz_types: ['recognize', 'stroke', 'blank'] })).quizTypes,
    ).toEqual(['recognize', 'stroke'])
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
