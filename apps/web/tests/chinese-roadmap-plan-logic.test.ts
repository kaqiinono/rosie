import { describe, expect, it } from 'vitest'
import {
  CHINESE_PLAN_QUIZ_TYPES,
  resolveChinesePlanCreateStatus,
  currentBatchLessonKeys,
  isLessonCompleteForPlan,
  presentPhasesForLesson,
  summarizeLessonPhases,
  computeAdvanceAfterBatch,
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
  it('unknown-only → []', () => {
    expect(mapPlanRowToModel(basePlanRow({ quiz_types: ['nope', 'x'] })).quizTypes).toEqual([])
  })
  it('valid subset preserved including blank', () => {
    expect(
      mapPlanRowToModel(basePlanRow({ quiz_types: ['recognize', 'stroke', 'blank'] })).quizTypes,
    ).toEqual(['recognize', 'stroke', 'blank'])
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

const emptyPlanContent = {
  charQuestions: [] as { lessonKey: string; quizType?: string; kind?: string }[],
  phraseItems: [] as { lessonKey: string }[],
  poems: [] as { unit: number; source?: string; lesson?: number }[],
  accumulationItems: [] as { unit: number }[],
  blankItems: [] as { lessonKey: string }[],
  readingLessons: [] as { lessonKey: string }[],
  pinyinWriteItems: [] as { lessonKey: string }[],
}

describe('presentPhasesForLesson', () => {
  it('collects quiz phases belonging to the lesson', () => {
    const phases = presentPhasesForLesson(
      'g1b-l01',
      'lesson',
      {
        ...emptyPlanContent,
        charQuestions: [
          { lessonKey: 'g1b-l01', kind: 'recognize' },
          { lessonKey: 'g1b-l01', kind: 'stroke' },
          { lessonKey: 'g1b-l02', kind: 'recognize' },
        ],
        phraseItems: [{ lessonKey: 'g1b-l01' }],
        blankItems: [{ lessonKey: 'g1b-l01' }],
        readingLessons: [{ lessonKey: 'g1b-l01' }],
        pinyinWriteItems: [{ lessonKey: 'g1b-l01' }],
      },
      { unit: 1, lesson: 1 },
    )
    expect(phases.sort()).toEqual(
      ['blank', 'passage', 'phrase', 'pinyin-write', 'recognize', 'stroke'].sort(),
    )
  })

  it('matches poems and garden accumulation only', () => {
    const plan = {
      ...emptyPlanContent,
      poems: [
        { unit: 1, source: 'lesson' as const, lesson: 1 },
        { unit: 1, source: 'garden' as const },
      ],
      accumulationItems: [{ unit: 1 }],
    }
    expect(
      presentPhasesForLesson('g1b-l01', 'lesson', plan, { unit: 1, lesson: 1 }).sort(),
    ).toEqual(['poems'])
    expect(
      presentPhasesForLesson('g1b-g01', 'garden', plan, { unit: 1, lesson: 0 }).sort(),
    ).toEqual(['accumulation', 'poems'].sort())
  })
})

describe('summarizeLessonPhases', () => {
  it('marks all present phases finished when sessionReachedDone', () => {
    const summary = summarizeLessonPhases({
      lessonKey: 'g1b-l01',
      lessonKind: 'lesson',
      plan: {
        ...emptyPlanContent,
        charQuestions: [{ lessonKey: 'g1b-l01', quizType: 'recognize' }],
      },
      lessonMeta: { unit: 1, lesson: 1 },
      sessionReachedDone: true,
    })
    expect(summary.presentPhases).toEqual(['recognize'])
    expect(summary.finishedPhases).toEqual(['recognize'])
  })
})

describe('computeAdvanceAfterBatch', () => {
  const ordered = ['a', 'b', 'c', 'd']
  it('advances to first incomplete and detects book finish', () => {
    expect(
      computeAdvanceAfterBatch({
        orderedKeys: ordered,
        completedLessonKeys: ['a'],
        newlyCompletedKeys: ['b'],
      }),
    ).toEqual({
      mergedCompleted: ['a', 'b'],
      nextCurrentLessonKey: 'c',
      bookFinished: false,
    })
    expect(
      computeAdvanceAfterBatch({
        orderedKeys: ordered,
        completedLessonKeys: ['a', 'b', 'c'],
        newlyCompletedKeys: ['d'],
      }).bookFinished,
    ).toBe(true)
  })
})
