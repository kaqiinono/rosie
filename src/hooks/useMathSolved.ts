'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useMathSolved(user: User | null) {
  const [solveCount, setSolveCount] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_solved')
      .select('problem_id, solve_count')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const record: Record<string, number> = {}
          data.forEach(row => { record[row.problem_id] = row.solve_count ?? 1 })
          setSolveCount(record)
        }
      })
  }, [user])

  const handleSolve = useCallback(async (id: string): Promise<number> => {
    if (!user) return 0

    const { data, error } = await supabase.rpc('increment_math_solved', {
      p_user_id: user.id,
      p_prob_id: id,
    })

    if (!error && typeof data === 'number') {
      setSolveCount(prev => ({ ...prev, [id]: data }))
      return data
    }

    // Optimistic fallback if RPC fails
    const newCount = (solveCount[id] ?? 0) + 1
    setSolveCount(prev => ({ ...prev, [id]: newCount }))
    return newCount
  }, [user, solveCount])

  return { solveCount, handleSolve }
}
