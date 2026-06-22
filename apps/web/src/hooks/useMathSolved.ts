'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useMathSolved(user: User | null) {
  const [solveCount, setSolveCount] = useState<Record<string, number>>({})
  const [solvedAt, setSolvedAt] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_solved')
      .select('problem_id, solve_count, solved_at')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const counts: Record<string, number> = {}
          const times: Record<string, string> = {}
          data.forEach(row => {
            counts[row.problem_id] = row.solve_count ?? 1
            if (row.solved_at) times[row.problem_id] = row.solved_at
          })
          setSolveCount(counts)
          setSolvedAt(times)
        }
      })
  }, [user])

  const handleSolve = useCallback(async (id: string): Promise<number> => {
    if (!user) return 0

    const now = new Date().toISOString()
    const { data, error } = await supabase.rpc('increment_math_solved', {
      p_user_id: user.id,
      p_prob_id: id,
    })

    if (!error && typeof data === 'number') {
      setSolveCount(prev => ({ ...prev, [id]: data }))
      setSolvedAt(prev => ({ ...prev, [id]: now }))
      return data
    }

    // Optimistic fallback if RPC fails
    const newCount = (solveCount[id] ?? 0) + 1
    setSolveCount(prev => ({ ...prev, [id]: newCount }))
    setSolvedAt(prev => ({ ...prev, [id]: now }))
    return newCount
  }, [user, solveCount])

  return { solveCount, solvedAt, handleSolve }
}
