'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

export type MathSolvedData = {
  solveCount: Record<string, number>
  solvedAt: Record<string, string>
}

const EMPTY: MathSolvedData = { solveCount: {}, solvedAt: {} }

async function fetchMathSolved(userId: string): Promise<MathSolvedData> {
  const { data } = await supabase
    .from('math_solved')
    .select('problem_id, solve_count, solved_at')
    .eq('user_id', userId)

  const solveCount: Record<string, number> = {}
  const solvedAt: Record<string, string> = {}
  for (const row of data ?? []) {
    solveCount[row.problem_id] = row.solve_count ?? 1
    if (row.solved_at) solvedAt[row.problem_id] = row.solved_at
  }
  return { solveCount, solvedAt }
}

export const mathSolvedStore = createUserSessionStore<MathSolvedData>('math_solved', {
  fetch: fetchMathSolved,
  empty: EMPTY,
})

export function useMathSolved(user: User | null) {
  const { data, isLoading } = mathSolvedStore.useSessionData(user)

  const handleSolve = useCallback(async (id: string): Promise<number> => {
    if (!user) return 0

    const now = new Date().toISOString()
    const { data: rpcData, error } = await supabase.rpc('increment_math_solved', {
      p_user_id: user.id,
      p_prob_id: id,
    })

    let newCount: number
    if (!error && typeof rpcData === 'number') {
      newCount = rpcData
    } else {
      newCount = (data.solveCount[id] ?? 0) + 1
    }

    mathSolvedStore.patchSessionData(user.id, (prev) => ({
      solveCount: { ...prev.solveCount, [id]: newCount },
      solvedAt: { ...prev.solvedAt, [id]: now },
    }))

    return newCount
  }, [user, data.solveCount])

  return {
    solveCount: data.solveCount,
    solvedAt: data.solvedAt,
    handleSolve,
    isLoading,
  }
}
