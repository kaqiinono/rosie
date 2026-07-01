'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { allMathProblemStats } from '@rosie/math/utils/grade-stats'

export type HomeStats = {
  mathPracticed: number
  mathTotal: number
  englishPracticed: number
  englishTotal: number
  calcTotal: number
  calcPracticeDays: number
  mistakesUnresolved: number
}

const EMPTY_STATS: HomeStats = {
  mathPracticed: 0,
  mathTotal: 0,
  englishPracticed: 0,
  englishTotal: 0,
  calcTotal: 0,
  calcPracticeDays: 0,
  mistakesUnresolved: 0,
}

function countUnresolved(rows: { resolved?: boolean | null }[] | null): number {
  return (rows ?? []).filter(r => !(r.resolved ?? false)).length
}

export function useHomeStats(user: User | null) {
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) {
      setStats(EMPTY_STATS)
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      const [
        { data: mathRows },
        { data: masteryRows },
        { count: vocabTotal },
        { data: calcRows },
        { data: mathWrongRows },
        { data: calcWrongRows },
        { data: englishWrongRows },
      ] = await Promise.all([
        supabase.from('math_solved').select('problem_id, solve_count').eq('user_id', user.id),
        supabase.from('word_mastery').select('correct, incorrect, last_seen').eq('user_id', user.id),
        supabase.from('word_entries').select('id', { count: 'exact', head: true }),
        supabase.from('calc_sessions').select('date, correct_count, retry_count, wrong_count').eq('user_id', user.id),
        supabase.from('math_wrong').select('resolved').eq('user_id', user.id),
        supabase.from('calc_mistakes').select('resolved').eq('user_id', user.id),
        supabase.from('english_wrong').select('resolved').eq('user_id', user.id),
      ])
      if (cancelled) return

      const solveCount: Record<string, number> = {}
      for (const row of mathRows ?? []) {
        solveCount[row.problem_id] = row.solve_count ?? 1
      }
      const { practiced: mathPracticed, total: mathTotal } = allMathProblemStats(solveCount)

      let englishPracticed = 0
      for (const row of masteryRows ?? []) {
        const attempts = (row.correct ?? 0) + (row.incorrect ?? 0)
        if (attempts > 0 || row.last_seen) englishPracticed++
      }

      const calcDays = new Set<string>()
      let calcTotal = 0
      for (const row of calcRows ?? []) {
        calcDays.add(row.date)
        calcTotal += (row.correct_count ?? 0) + (row.retry_count ?? 0) + (row.wrong_count ?? 0)
      }

      setStats({
        mathPracticed,
        mathTotal,
        englishPracticed,
        englishTotal: vocabTotal ?? 0,
        calcTotal,
        calcPracticeDays: calcDays.size,
        mistakesUnresolved:
          countUnresolved(mathWrongRows) +
          countUnresolved(calcWrongRows) +
          countUnresolved(englishWrongRows),
      })
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  return { stats, isLoading }
}
