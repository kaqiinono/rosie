import { describe, it, expect } from 'vitest'
import type { Problem, ProblemSet, MathWeeklyPlanDay, MathDayProgress } from '@rosie/core'
import { buildMathFlexiblePlan } from '@rosie/math-kit/utils/math-helpers'

function stubProblem(id: string, tag = 'type1', difficulty = 1): Problem {
  return {
    id,
    title: id,
    tag,
    tagLabel: tag,
    difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
    text: id,
    analysis: [],
    type: 'none',
    finalQ: '',
    finalUnit: '',
    finalAns: 0,
  }
}

function stubSet(ids: string[]): ProblemSet {
  return {
    pretest: [],
    lesson: ids.map((id, i) => stubProblem(id, 'type1', (i % 5) + 1)),
    homework: [],
    workbook: [],
  }
}

describe('buildMathFlexiblePlan — preserve past days on rebuild', () => {
  const lessonId = '1-99'
  const problemSets = { [lessonId]: stubSet(['a', 'b', 'c', 'd', 'e', 'f']) }
  const sectionFilters = { [lessonId]: ['lesson'] }

  it('without preserve options, rebuilds all days (baseline)', () => {
    const { days } = buildMathFlexiblePlan(
      [lessonId],
      sectionFilters,
      problemSets,
      '2026-08-01',
      '2026-08-03',
    )
    expect(days).toHaveLength(3)
    const keys = days.flatMap((d) => d.problems.map((p) => p.problemId)).sort()
    expect(keys).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('keeps days before freezeDate unchanged and excludes their problems from later days', () => {
    const existingDays: MathWeeklyPlanDay[] = [
      {
        date: '2026-08-01',
        problems: [
          {
            key: `${lessonId}::a`,
            lessonId,
            section: 'lesson',
            index: 1,
            title: 'a',
            problemId: 'a',
            tagLabel: 'type1',
          },
          {
            key: `${lessonId}::b`,
            lessonId,
            section: 'lesson',
            index: 2,
            title: 'b',
            problemId: 'b',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-02',
        problems: [
          {
            key: `${lessonId}::c`,
            lessonId,
            section: 'lesson',
            index: 3,
            title: 'c',
            problemId: 'c',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-03',
        problems: [
          {
            key: `${lessonId}::d`,
            lessonId,
            section: 'lesson',
            index: 4,
            title: 'd',
            problemId: 'd',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
    ]

    const { days } = buildMathFlexiblePlan(
      [lessonId],
      sectionFilters,
      problemSets,
      '2026-08-01',
      '2026-08-03',
      {},
      {},
      {
        existingDays,
        freezeDate: '2026-08-02',
      },
    )

    expect(days[0]!.problems.map((p) => p.problemId)).toEqual(['a', 'b'])
    const laterIds = days.slice(1).flatMap((d) => d.problems.map((p) => p.problemId))
    expect(laterIds).not.toContain('a')
    expect(laterIds).not.toContain('b')
    expect(laterIds.sort()).toEqual(['c', 'd', 'e', 'f'])
  })

  it('also freezes fully completed days on/after freezeDate', () => {
    const existingDays: MathWeeklyPlanDay[] = [
      {
        date: '2026-08-01',
        problems: [
          {
            key: `${lessonId}::a`,
            lessonId,
            section: 'lesson',
            index: 1,
            title: 'a',
            problemId: 'a',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-02',
        problems: [
          {
            key: `${lessonId}::b`,
            lessonId,
            section: 'lesson',
            index: 2,
            title: 'b',
            problemId: 'b',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-03',
        problems: [
          {
            key: `${lessonId}::c`,
            lessonId,
            section: 'lesson',
            index: 3,
            title: 'c',
            problemId: 'c',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
    ]
    const progress: Record<string, MathDayProgress> = {
      '2026-08-02': { doneKeys: [`${lessonId}::b`] },
    }

    const { days } = buildMathFlexiblePlan(
      [lessonId],
      sectionFilters,
      problemSets,
      '2026-08-01',
      '2026-08-03',
      {},
      {},
      {
        existingDays,
        freezeDate: '2026-08-02',
        progress,
      },
    )

    expect(days[0]!.problems.map((p) => p.problemId)).toEqual(['a'])
    expect(days[1]!.problems.map((p) => p.problemId)).toEqual(['b'])
    const laterIds = days[2]!.problems.map((p) => p.problemId)
    expect(laterIds).not.toContain('a')
    expect(laterIds).not.toContain('b')
    expect(laterIds.sort()).toEqual(['c', 'd', 'e', 'f'])
  })

  it('returns frozen-day problems to the pool when those dates leave the new range', () => {
    const existingDays: MathWeeklyPlanDay[] = [
      {
        date: '2026-08-01',
        problems: [
          {
            key: `${lessonId}::a`,
            lessonId,
            section: 'lesson',
            index: 1,
            title: 'a',
            problemId: 'a',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-02',
        problems: [
          {
            key: `${lessonId}::b`,
            lessonId,
            section: 'lesson',
            index: 2,
            title: 'b',
            problemId: 'b',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
    ]

    const { days } = buildMathFlexiblePlan(
      [lessonId],
      sectionFilters,
      problemSets,
      '2026-08-02',
      '2026-08-03',
      {},
      {},
      {
        existingDays,
        freezeDate: '2026-08-02',
      },
    )

    const allIds = days.flatMap((d) => d.problems.map((p) => p.problemId)).sort()
    expect(allIds).toContain('a')
    expect(allIds).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('uses the new filter pool on rebuild, still excluding problems already on frozen days', () => {
    // Existing plan scheduled a,b on a past day. Parent then narrows the tag filter so
    // only type2 remains in the selection — but a/b were type1 and stay frozen historically.
    const mixedSets: Record<string, ProblemSet> = {
      [lessonId]: {
        pretest: [],
        lesson: [
          stubProblem('a', 'type1', 1),
          stubProblem('b', 'type1', 1),
          stubProblem('c', 'type2', 1),
          stubProblem('d', 'type2', 2),
          stubProblem('e', 'type2', 3),
        ],
        homework: [],
        workbook: [],
      },
    }
    const existingDays: MathWeeklyPlanDay[] = [
      {
        date: '2026-08-01',
        problems: [
          {
            key: `${lessonId}::a`,
            lessonId,
            section: 'lesson',
            index: 1,
            title: 'a',
            problemId: 'a',
            tagLabel: 'type1',
          },
          {
            key: `${lessonId}::b`,
            lessonId,
            section: 'lesson',
            index: 2,
            title: 'b',
            problemId: 'b',
            tagLabel: 'type1',
          },
        ],
        optionalProblems: [],
      },
      {
        date: '2026-08-02',
        problems: [
          {
            key: `${lessonId}::c`,
            lessonId,
            section: 'lesson',
            index: 3,
            title: 'c',
            problemId: 'c',
            tagLabel: 'type2',
          },
        ],
        optionalProblems: [],
      },
    ]

    const { days } = buildMathFlexiblePlan(
      [lessonId],
      sectionFilters,
      mixedSets,
      '2026-08-01',
      '2026-08-03',
      { [lessonId]: ['type2'] },
      {},
      {
        existingDays,
        freezeDate: '2026-08-02',
      },
    )

    // Frozen past day keeps historical type1 schedule even though filter no longer includes them.
    expect(days[0]!.problems.map((p) => p.problemId)).toEqual(['a', 'b'])
    const laterIds = days.slice(1).flatMap((d) => d.problems.map((p) => p.problemId)).sort()
    // Rebuild pool = current filter (type2: c,d,e) minus nothing from frozen (a,b not in filter).
    expect(laterIds).toEqual(['c', 'd', 'e'])
    expect(laterIds).not.toContain('a')
    expect(laterIds).not.toContain('b')
  })
})
