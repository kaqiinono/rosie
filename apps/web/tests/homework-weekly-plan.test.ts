import { describe, expect, it } from 'vitest'
import { isDailyEnglishPlanPath, weeklyPlanForDate } from '@/components/time-tree/weeklyPlanPractice'
import { homeworkCardSummary } from '@/components/time-tree/homeworkCardSummary'

const earlierPlan = {
  id: 'earlier',
  weekStart: '2026-11-18',
  days: [
    { date: '2026-11-19', newWordKeys: [] },
    { date: '2026-11-20', newWordKeys: ['earlier-word'] },
    { date: '2026-11-21', newWordKeys: ['last-word'] },
  ],
}

const laterPlan = {
  id: 'later',
  weekStart: '2026-11-21',
  days: [{ date: '2026-11-21', newWordKeys: ['later-word'] }],
}

describe('daily English homework practice', () => {
  it('groups the assigned words by their actual unit and lesson for that date', () => {
    const plan = {
      ...earlierPlan, unit: 'unit1', lesson: 'lesson1',
      days: [{ date: '2026-11-20', newWordKeys: ['unit3::lesson2::apple', 'unit4::lesson1::peach', 'unit3::lesson2::pear'] }],
    }
    const content = { name: '今日英语计划', row: null, href: '/english/words/daily', exhausted: false, provisional: true }
    expect(homeworkCardSummary(content, '2026-11-20', [plan])?.wordGroups).toEqual([
      { scope: 'Unit 3 · Lesson 2', words: ['apple', 'pear'] },
      { scope: 'Unit 4 · Lesson 1', words: ['peach'] },
    ])
  })

  it('recognizes the saved daily preset route', () => {
    expect(isDailyEnglishPlanPath('/english/words/daily')).toBe(true)
    expect(isDailyEnglishPlanPath('/english/words/weekly/plan/practice?date=2026-11-20')).toBe(false)
  })

  it('finds the assignment for the original scheduled date', () => {
    expect(weeklyPlanForDate([laterPlan, earlierPlan], '2026-11-20')).toBe(earlierPlan)
    expect(weeklyPlanForDate([laterPlan, earlierPlan], '2026-11-19')).toBeUndefined()
  })

  it('uses the later starting plan on a shared date regardless of input order', () => {
    expect(weeklyPlanForDate([earlierPlan, laterPlan], '2026-11-21')).toBe(laterPlan)
    expect(weeklyPlanForDate([laterPlan, earlierPlan], '2026-11-21')).toBe(laterPlan)
  })
})
