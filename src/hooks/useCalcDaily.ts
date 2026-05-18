'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { todayStr } from '@/utils/constant'

interface DailySummary {
  todayDone: number          // questions answered today (correct + retry + wrong)
  todayCorrect: number       // first-try-correct + retry-correct
  todayTarget: number        // user's lastCount preference
  todayCoins: number
  isLoading: boolean
}

interface SessionRow {
  correct_count: number
  retry_count: number
  wrong_count: number
  coins_earned: number
}

interface SettingsRow {
  last_count: number
}

const DEFAULT_TARGET = 20

export function useCalcDaily(user: User | null): DailySummary {
  const [summary, setSummary] = useState<DailySummary>({
    todayDone: 0,
    todayCorrect: 0,
    todayTarget: DEFAULT_TARGET,
    todayCoins: 0,
    isLoading: user !== null,
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const today = todayStr()
      const [sessionsRes, settingsRes] = await Promise.all([
        supabase
          .from('calc_sessions')
          .select('correct_count,retry_count,wrong_count,coins_earned')
          .eq('user_id', user.id)
          .eq('date', today),
        supabase
          .from('calc_settings')
          .select('last_count')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])
      if (cancelled) return
      const sessions = (sessionsRes.data ?? []) as SessionRow[]
      const target = (settingsRes.data as SettingsRow | null)?.last_count ?? DEFAULT_TARGET
      let done = 0, correct = 0, coins = 0
      for (const s of sessions) {
        done += s.correct_count + s.retry_count + s.wrong_count
        correct += s.correct_count + s.retry_count
        coins += s.coins_earned
      }
      setSummary({
        todayDone: done,
        todayCorrect: correct,
        todayTarget: target,
        todayCoins: coins,
        isLoading: false,
      })
    }
    void init()
    return () => { cancelled = true }
  }, [user])

  return summary
}
