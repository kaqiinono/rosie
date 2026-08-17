import { describe, expect, it } from 'vitest'
import { buildPracticeQueue, deferQueueItem } from '@rosie/math/utils/build-practice-queue'
import { findHelpProblems } from '@rosie/math-kit/utils/practice-help-problems'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import type { Problem, ProblemSet } from '@rosie/core'
import { PROBLEMS as LESSON_35_PROBLEMS } from '@rosie/math-content/utils/g1/lesson35-data'

function item(id: string, assignmentId?: string): PracticeQueueItem {
  return {
    problem: { id, title: id },
    lessonId: '1-12',
    section: 'lesson',
    detailHref: `/math/${id}`,
    planAssignment: assignmentId
      ? { assignmentId, planStart: '2026-08-13', date: '2026-08-17' }
      : undefined,
  } as PracticeQueueItem
}

describe('math practice queue ordering', () => {
  it('prioritizes unseen, then fewer attempts, older attempts, and stable id', () => {
    const queue = buildPracticeQueue(
      [item('d'), item('c'), item('b'), item('a')],
      { a: 0, b: 1, c: 1, d: 2 },
      { b: '2026-08-16T00:00:00Z', c: '2026-08-15T00:00:00Z' },
    )
    expect(queue.map((entry) => entry.problem.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('preserves fixed plan or paper order when requested', () => {
    const queue = buildPracticeQueue(
      [item('b'), item('a')],
      { a: 0, b: 5 },
      {},
      true,
    )
    expect(queue.map((entry) => entry.problem.id)).toEqual(['b', 'a'])
  })
})

describe('deferQueueItem', () => {
  it('moves a middle item to the tail without changing the current index', () => {
    const original = ['A', 'B', 'C', 'D']
    const deferred = deferQueueItem(original, 1)
    expect(deferred).toEqual({ items: ['A', 'C', 'D', 'B'], result: 'moved' })
    expect(original).toEqual(['A', 'B', 'C', 'D'])
  })

  it('rotates multiple deferred problems behind the remaining work', () => {
    const first = deferQueueItem(['A', 'B', 'C'], 0)
    const second = deferQueueItem(first.items, 0)
    expect(second.items).toEqual(['C', 'A', 'B'])
  })

  it('does not finish or mutate the queue when only the current problem remains', () => {
    const items = ['A', 'B']
    const deferred = deferQueueItem(items, 1)
    expect(deferred).toEqual({ items, result: 'only_remaining' })
    expect(deferred.items).toBe(items)
  })
})

describe('practice help ordering', () => {
  function problem(id: string, tag: string, analysisImg?: string): Problem {
    return { id, title: id, tag, difficulty: 2, analysisImg } as Problem
  }

  it('keeps the exact subtype, excludes the current problem, and prioritizes classroom screenshots then fewer attempts', () => {
    const current = problem('current', 'type-4')
    const set = {
      pretest: [problem('pretest-shot', 'type-4', '/shot.png')],
      lesson: [
        current,
        problem('lesson-plain', 'type-4'),
        problem('lesson-shot-used', 'type-4', '/used.png'),
        problem('lesson-shot-new', 'type-4', '/new.png'),
        problem('other-type', 'type-3', '/other.png'),
      ],
      homework: [],
      workbook: [],
      supplement: [],
    } as ProblemSet

    expect(
      findHelpProblems(set, current, { 'lesson-shot-used': 3 }).map(({ problem: p }) => p.id),
    ).toEqual(['lesson-shot-new', 'lesson-shot-used', 'lesson-plain', 'pretest-shot'])
  })
})

describe('practice attempt problem identity', () => {
  it('uses globally unique canonical ids for lesson 35', () => {
    const ids = Object.values(LESSON_35_PROBLEMS).flat().map((problem) => problem.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => /^1-35-[PLHWS]\d+$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
