import { describe, it, expect } from 'vitest'
import type { MathPlanProblem, MathWeeklyPlanDay } from '@rosie/core'
import {
  collectOverduePlanProblems,
  planProblemAnswerStatus,
  planProblemExecStatus,
} from '@rosie/math-kit/utils/math-helpers'

function prob(id: string): MathPlanProblem {
  return {
    key: `1-99::${id}`,
    lessonId: '1-99',
    section: 'lesson',
    index: 1,
    title: id,
    problemId: id,
    tagLabel: 'type1',
  }
}

describe('collectOverduePlanProblems', () => {
  const days: MathWeeklyPlanDay[] = [
    { date: '2026-08-01', problems: [prob('a'), prob('b')], optionalProblems: [] },
    { date: '2026-08-02', problems: [prob('c')], optionalProblems: [] },
    { date: '2026-08-03', problems: [prob('d')], optionalProblems: [] },
  ]

  it('returns unfinished required problems before today, in date order', () => {
    const overdue = collectOverduePlanProblems(
      {
        days,
        progress: {
          '2026-08-01': { doneKeys: ['1-99::a'] },
        },
      },
      '2026-08-03',
    )
    expect(overdue.map((item) => `${item.date}:${item.problem.problemId}`)).toEqual([
      '2026-08-01:b',
      '2026-08-02:c',
    ])
  })

  it('returns empty when nothing is overdue', () => {
    const overdue = collectOverduePlanProblems(
      {
        days,
        progress: {
          '2026-08-01': { doneKeys: ['1-99::a', '1-99::b'] },
          '2026-08-02': { doneKeys: ['1-99::c'] },
        },
      },
      '2026-08-03',
    )
    expect(overdue).toEqual([])
  })
})

describe('plan problem status helpers', () => {
  it('exec status from doneKeys', () => {
    expect(planProblemExecStatus('k1', ['k1'])).toBe('done')
    expect(planProblemExecStatus('k1', new Set(['k2']))).toBe('pending')
  })

  it('answer status prefers wrong over practiced', () => {
    expect(
      planProblemAnswerStatus('p1', { wrongIds: new Set(['p1']), solveCount: { p1: 2 } }),
    ).toBe('wrong')
    expect(
      planProblemAnswerStatus('p1', { wrongIds: new Set(), solveCount: { p1: 1 } }),
    ).toBe('practiced')
    expect(
      planProblemAnswerStatus('p1', { wrongIds: new Set(), solveCount: {} }),
    ).toBe('unseen')
  })
})
