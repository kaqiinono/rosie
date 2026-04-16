'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useMathWrong(user: User | null) {
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_wrong')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setWrongIds(new Set(data.map(r => r.problem_id)))
      })
  }, [user])

  const removeWrong = useCallback(async (problemId: string) => {
    if (!user) return
    setWrongIds(prev => {
      const next = new Set(prev)
      next.delete(problemId)
      return next
    })
    await supabase
      .from('math_wrong')
      .delete()
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
  }, [user])

  return { wrongIds, removeWrong }
}
