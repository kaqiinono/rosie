import { describe, expect, it } from 'vitest'
import { aggregateAiQualityMetrics } from '@rosie/ai'

describe('AI quality metrics', () => {
  it('aggregates only non-sensitive counters and rates', () => {
    const result = aggregateAiQualityMetrics(
      [
        { role: 'user', sources: [] },
        { role: 'assistant', sources: [{ sourceRef: 'a' }] },
        { role: 'assistant', sources: [] },
      ],
      [
        {
          subject: 'math',
          status: 'completed',
          hint_level: 2,
          attempt_count: 3,
          state: { verification: { kind: 'math_problem' } },
        },
        {
          subject: 'english',
          status: 'active',
          hint_level: 0,
          attempt_count: 1,
          state: {},
        },
      ],
    )
    expect(result).toMatchObject({
      assistantResponses: 2,
      knowledgeHitRate: 0.5,
      noSourceRate: 0.5,
      teachingSessions: 2,
      teachingCompletionRate: 0.5,
      verifiedSessions: 1,
      averageHintLevel: 1,
      averageAttempts: 2,
    })
    expect(result.bySubject.math).toEqual({ sessions: 1, completed: 1, verified: 1 })
  })
})
