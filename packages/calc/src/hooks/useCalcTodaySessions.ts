'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, todayStr } from '@rosie/core'

export type CalcTodaySessionRow = {
  id: string
  date: string
  started_at: string
  finished_at: string
  time_spent_sec: number | null
  correct_count: number | null
  retry_count: number | null
  wrong_count: number | null
  mode: string | null
}

async function fetchCalcTodaySessions(userId: string): Promise<CalcTodaySessionRow[]> {
  const today = todayStr()
  const { data, error } = await supabase
    .from('calc_sessions')
    .select(
      'id,date,started_at,finished_at,time_spent_sec,correct_count,retry_count,wrong_count,mode',
    )
    .eq('user_id', userId)
    .eq('date', today)
    .order('finished_at', { ascending: false })
  if (error) console.error('[calc_sessions_today] fetch failed', error)
  return (data ?? []) as CalcTodaySessionRow[]
}

export const calcTodaySessionsStore = createUserSessionStore<CalcTodaySessionRow[]>(
  'calc_sessions_today',
  {
    fetch: fetchCalcTodaySessions,
    empty: [],
  },
)

export function useCalcTodaySessions(user: User | null) {
  const { data: sessions, isLoading } = calcTodaySessionsStore.useSessionData(user)

  const today = todayStr()
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === today),
    [sessions, today],
  )

  return { sessions: todaySessions, isLoading }
}
