'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

export type MathPracticeStatsData = {
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  wrongCount: Record<string, number>
  lastAttemptedAt: Record<string, string>
  lastCorrectAt: Record<string, string>
}

type PracticeStatsDbRow = {
  problem_id: string
  practice_count: number | null
  correct_count: number | null
  wrong_count: number | null
  last_attempted_at: string | null
  last_correct_at: string | null
}

const EMPTY: MathPracticeStatsData = {
  practiceCount: {},
  correctCount: {},
  wrongCount: {},
  lastAttemptedAt: {},
  lastCorrectAt: {},
}

async function fetchMathPracticeStats(userId: string): Promise<MathPracticeStatsData> {
  const { data, error } = await supabase
    .from('math_problem_practice_stats')
    .select(
      'problem_id,practice_count,correct_count,wrong_count,last_attempted_at,last_correct_at',
    )
    .eq('user_id', userId)

  if (error) throw error

  const next: MathPracticeStatsData = {
    practiceCount: {},
    correctCount: {},
    wrongCount: {},
    lastAttemptedAt: {},
    lastCorrectAt: {},
  }
  for (const row of (data ?? []) as PracticeStatsDbRow[]) {
    next.practiceCount[row.problem_id] = row.practice_count ?? 0
    next.correctCount[row.problem_id] = row.correct_count ?? 0
    next.wrongCount[row.problem_id] = row.wrong_count ?? 0
    if (row.last_attempted_at) next.lastAttemptedAt[row.problem_id] = row.last_attempted_at
    if (row.last_correct_at) next.lastCorrectAt[row.problem_id] = row.last_correct_at
  }
  return next
}

export const mathPracticeStatsStore = createUserSessionStore<MathPracticeStatsData>(
  'math_problem_practice_stats',
  { fetch: fetchMathPracticeStats, empty: EMPTY },
)

export function patchMathPracticeStats(
  userId: string,
  problemId: string,
  correct: boolean,
  attemptedAt = new Date().toISOString(),
): void {
  mathPracticeStatsStore.patchSessionData(userId, (prev) => ({
    practiceCount: {
      ...prev.practiceCount,
      [problemId]: (prev.practiceCount[problemId] ?? 0) + 1,
    },
    correctCount: {
      ...prev.correctCount,
      [problemId]: (prev.correctCount[problemId] ?? 0) + (correct ? 1 : 0),
    },
    wrongCount: {
      ...prev.wrongCount,
      [problemId]: (prev.wrongCount[problemId] ?? 0) + (correct ? 0 : 1),
    },
    lastAttemptedAt: { ...prev.lastAttemptedAt, [problemId]: attemptedAt },
    lastCorrectAt: correct
      ? { ...prev.lastCorrectAt, [problemId]: attemptedAt }
      : prev.lastCorrectAt,
  }))
}

export function useMathPracticeStats(user: User | null) {
  const { data, isLoading } = mathPracticeStatsStore.useSessionData(user)

  const refresh = useCallback(() => {
    if (!user) return
    void mathPracticeStatsStore.refreshInBackground(user.id)
  }, [user])

  return { ...data, isLoading, refresh }
}
