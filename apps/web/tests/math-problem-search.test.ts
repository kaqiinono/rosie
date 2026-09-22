import { describe, expect, it } from 'vitest'
import type { Problem } from '@rosie/core'
import { searchProblems, type SearchableProblem } from '@rosie/math/utils/math-problem-search'

function problemItem(index: number): SearchableProblem {
  const id = `problem-${index}`
  return {
    problem: {
      id,
      title: `题目 ${index}`,
      text: `题干 ${index}`,
      tag: 'calculation',
      tagLabel: '计算',
      difficulty: 1,
    } as Problem,
    lessonId: '1-9',
    lessonTitle: '乘除巧算',
    setName: '课堂',
    sectionLabel: '题目',
  }
}

describe('math problem search', () => {
  it('returns every supplied result unless the caller explicitly limits it', () => {
    const pool = Array.from({ length: 48 }, (_, index) => problemItem(index + 1))

    expect(searchProblems(pool, '')).toHaveLength(48)
    expect(searchProblems(pool, '题目')).toHaveLength(48)
    expect(searchProblems(pool, '', 40)).toHaveLength(40)
  })
})
