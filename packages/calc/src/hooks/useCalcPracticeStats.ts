'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getWeekStart, supabase } from '@rosie/core'

function questionCount(row: {
  correct_count: number | null
  retry_count: number | null
  wrong_count: number | null
}): number {
  return (row.correct_count ?? 0) + (row.retry_count ?? 0) + (row.wrong_count ?? 0)
}

export function useCalcPracticeStats(user: User | null) {
  const [totalProblems, setTotalProblems] = useState(0)
  const [practiceDays, setPracticeDays] = useState(0)
  const [weekProblems, setWeekProblems] = useState(0)
  const [monthProblems, setMonthProblems] = useState(0)
  const [yearProblems, setYearProblems] = useState(0)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) {
      setTotalProblems(0)
      setPracticeDays(0)
      setWeekProblems(0)
      setMonthProblems(0)
      setYearProblems(0)
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('calc_sessions')
        .select('date,correct_count,retry_count,wrong_count')
        .eq('user_id', user.id)
      if (cancelled) return

      const now = new Date()
      const weekStart = getWeekStart(now)
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const yearPrefix = `${now.getFullYear()}`

      const days = new Set<string>()
      let total = 0
      let weekTotal = 0
      let monthTotal = 0
      let yearTotal = 0

      for (const row of data ?? []) {
        days.add(row.date)
        const count = questionCount(row)
        total += count
        if (row.date >= weekStart) weekTotal += count
        if (row.date.startsWith(monthPrefix)) monthTotal += count
        if (row.date.startsWith(yearPrefix)) yearTotal += count
      }

      setTotalProblems(total)
      setPracticeDays(days.size)
      setWeekProblems(weekTotal)
      setMonthProblems(monthTotal)
      setYearProblems(yearTotal)
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  return { totalProblems, practiceDays, weekProblems, monthProblems, yearProblems, isLoading }
}
