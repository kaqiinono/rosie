'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, localDateStr, supabase, todayStr } from '@rosie/core'
import type { MathPracticeAttemptRow } from '@rosie/math/hooks/math-scratch-types'

type AttemptDbRow = {
  id: string
  user_id: string
  problem_id: string
  lesson_id: string
  section: string
  paper_id: string | null
  correct: boolean
  draft_id: string | null
  answer_snapshot: unknown | null
  attempted_at: string
}

function rowToAttempt(r: AttemptDbRow): MathPracticeAttemptRow {
  return {
    id: r.id,
    userId: r.user_id,
    problemId: r.problem_id,
    lessonId: r.lesson_id,
    section: r.section,
    paperId: r.paper_id,
    correct: r.correct,
    draftId: r.draft_id,
    answerSnapshot: r.answer_snapshot,
    attemptedAt: r.attempted_at,
  }
}

function todayRangeIso(today = todayStr()): { start: string; end: string } {
  // Local calendar day → ISO bounds (timestamptz compare).
  const start = new Date(`${today}T00:00:00`).toISOString()
  const end = new Date(`${today}T23:59:59.999`).toISOString()
  return { start, end }
}

async function fetchMathTodayAttempts(userId: string): Promise<MathPracticeAttemptRow[]> {
  const { start, end } = todayRangeIso()
  const { data, error } = await supabase
    .from('math_practice_attempts')
    .select(
      'id,user_id,problem_id,lesson_id,section,paper_id,correct,draft_id,answer_snapshot,attempted_at',
    )
    .eq('user_id', userId)
    .gte('attempted_at', start)
    .lte('attempted_at', end)
    .order('attempted_at', { ascending: false })
  if (error) {
    console.error('[math_practice_attempts_today] fetch failed', error)
    return []
  }
  return ((data ?? []) as AttemptDbRow[]).map(rowToAttempt)
}

export const mathTodayAttemptsStore = createUserSessionStore<MathPracticeAttemptRow[]>(
  'math_practice_attempts_today',
  {
    fetch: fetchMathTodayAttempts,
    empty: [],
  },
)

export function useMathTodayAttempts(user: User | null) {
  const { data: attempts, isLoading } = mathTodayAttemptsStore.useSessionData(user)
  const today = todayStr()
  const todayAttempts = useMemo(
    () => attempts.filter((a) => localDateStr(new Date(a.attemptedAt)) === today),
    [attempts, today],
  )
  return { attempts: todayAttempts, isLoading }
}
