'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, todayStr } from '@rosie/core'
import { useCalcWallet } from '@rosie/rewards'
import { calcSettingsStore } from './useCalcSettings'

export type CalcSessionSummaryRow = {
  date: string
  correct_count: number | null
  retry_count: number | null
  wrong_count: number | null
}

type CalcDailyData = {
  sessions: CalcSessionSummaryRow[]
}

async function fetchCalcDailyData(userId: string): Promise<CalcDailyData> {
  const { data, error } = await supabase
    .from('calc_sessions')
    .select('date,correct_count,retry_count,wrong_count')
    .eq('user_id', userId)
  if (error) console.error('[calc_session_summaries] fetch failed', error)
  return { sessions: (data ?? []) as CalcSessionSummaryRow[] }
}

export const calcSessionSummariesStore = createUserSessionStore<CalcDailyData>(
  'calc_session_summaries',
  {
    fetch: fetchCalcDailyData,
    empty: { sessions: [] },
  },
)

const DEFAULT_TARGET = 20

export function useCalcDaily(user: User | null) {
  const { data: dailyData, isLoading: sessionsLoading } =
    calcSessionSummariesStore.useSessionData(user)
  const { data: settings, isLoading: settingsLoading } = calcSettingsStore.useSessionData(user)
  // Reuse StarHud wallet star_sessions — avoids a second today-coins query.
  const wallet = useCalcWallet(user)

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
      todayCoins: wallet.todayCoinsEarned,
      isLoading: sessionsLoading || settingsLoading || wallet.isLoading,
    }
  }, [
    dailyData,
    settings.lastCount,
    sessionsLoading,
    settingsLoading,
    wallet.todayCoinsEarned,
    wallet.isLoading,
  ])

  return summary
}
