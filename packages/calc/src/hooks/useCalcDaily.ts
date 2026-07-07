'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, todayStr } from '@rosie/core'
import { calcSettingsStore } from './useCalcSettings'

export type CalcSessionSummaryRow = {
  date: string
  correct_count: number | null
  retry_count: number | null
  wrong_count: number | null
}

type CalcDailyData = {
  sessions: CalcSessionSummaryRow[]
  todayCoins: number
}

async function fetchCalcDailyData(userId: string): Promise<CalcDailyData> {
  const today = todayStr()
  const [sessionsRes, starsRes] = await Promise.all([
    supabase
      .from('calc_sessions')
      .select('date,correct_count,retry_count,wrong_count')
      .eq('user_id', userId),
    supabase
      .from('star_sessions')
      .select('coins_earned')
      .eq('user_id', userId)
      .eq('source', 'calc')
      .eq('date', today),
  ])
  const sessions = (sessionsRes.data ?? []) as CalcSessionSummaryRow[]
  const todayCoins = ((starsRes.data ?? []) as { coins_earned: number | null }[]).reduce(
    (sum, r) => sum + (r.coins_earned ?? 0),
    0,
  )
  return { sessions, todayCoins }
}

export const calcSessionSummariesStore = createUserSessionStore<CalcDailyData>(
  'calc_session_summaries',
  {
    fetch: fetchCalcDailyData,
    empty: { sessions: [], todayCoins: 0 },
  },
)

const DEFAULT_TARGET = 20

export function useCalcDaily(user: User | null) {
  const { data: dailyData, isLoading: sessionsLoading } =
    calcSessionSummariesStore.useSessionData(user)
  const { data: settings, isLoading: settingsLoading } = calcSettingsStore.useSessionData(user)

  const summary = useMemo(() => {
    const today = todayStr()
    let done = 0
    let correct = 0
    for (const s of dailyData.sessions) {
      if (s.date !== today) continue
      done += (s.correct_count ?? 0) + (s.retry_count ?? 0) + (s.wrong_count ?? 0)
      correct += (s.correct_count ?? 0) + (s.retry_count ?? 0)
    }
    return {
      todayDone: done,
      todayCorrect: correct,
      todayTarget: settings.lastCount ?? DEFAULT_TARGET,
      todayCoins: dailyData.todayCoins,
      isLoading: sessionsLoading || settingsLoading,
    }
  }, [dailyData, settings.lastCount, sessionsLoading, settingsLoading])

  return summary
}
