import { describe, expect, it } from 'vitest'
import { todayProgressFromSummaries } from '@rosie/calc'

describe('todayProgressFromSummaries', () => {
  it('sums only rows matching today', () => {
    const r = todayProgressFromSummaries(
      [
        { date: '2026-08-03', correct_count: 8, retry_count: 1, wrong_count: 1 },
        { date: '2026-08-02', correct_count: 20, retry_count: 0, wrong_count: 0 },
      ],
      '2026-08-03',
    )
    expect(r.todayProblems).toBe(10)
    expect(r.todayCorrect).toBe(9)
  })

  it('returns zeros when no today rows', () => {
    expect(todayProgressFromSummaries([], '2026-08-03')).toEqual({
      todayProblems: 0,
      todayCorrect: 0,
    })
  })
})
