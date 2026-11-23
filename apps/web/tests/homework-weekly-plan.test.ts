import { describe, expect, it } from 'vitest'
import { isDailyEnglishPlanPath, weeklyPlanForDate } from '@/components/time-tree/weeklyPlanPractice'

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
