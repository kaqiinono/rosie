'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { getWeekStart } from '@rosie/core'
import { calcSessionSummariesStore, type CalcSessionSummaryRow } from './useCalcDaily'

function questionCount(row: CalcSessionSummaryRow): number {
  return (row.correct_count ?? 0) + (row.retry_count ?? 0) + (row.wrong_count ?? 0)
}

export function useCalcPracticeStats(user: User | null) {
  const { data: dailyData, isLoading } = calcSessionSummariesStore.useSessionData(user)
  const sessions = dailyData.sessions

  const stats = useMemo(() => {
    const now = new Date()
    const weekStart = getWeekStart(now)
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const yearPrefix = `${now.getFullYear()}`

    const days = new Set<string>()
    let total = 0
    let weekTotal = 0
    let monthTotal = 0
    let yearTotal = 0

    for (const row of sessions) {
      days.add(row.date)
      const count = questionCount(row)
      total += count
      if (row.date >= weekStart) weekTotal += count
      if (row.date.startsWith(monthPrefix)) monthTotal += count
      if (row.date.startsWith(yearPrefix)) yearTotal += count
    }

    return {
      totalProblems: total,
      practiceDays: days.size,
      weekProblems: weekTotal,
      monthProblems: monthTotal,
      yearProblems: yearTotal,
    }
  }, [sessions])

  return { ...stats, isLoading }
}
