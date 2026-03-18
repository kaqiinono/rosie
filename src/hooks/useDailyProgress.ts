'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const DP_STORAGE_KEY = 'wm_daily_progress'

export type DailyProgressRecord = Record<string, { quizDone?: boolean; lastScore?: number; lastDate?: string }>

export function loadProgress(): DailyProgressRecord {
  try { return JSON.parse(localStorage.getItem(DP_STORAGE_KEY) || '{}') }
  catch { return {} }
}

export function saveProgress(p: DailyProgressRecord) {
  localStorage.setItem(DP_STORAGE_KEY, JSON.stringify(p))
}

export function useDailyProgress(user: User | null) {
  const syncProgressToCloud = useCallback(async (p: DailyProgressRecord) => {
    if (!user) return
    const rows = Object.entries(p).map(([day, val]) => ({
      user_id: user.id,
      day_number: Number(day),
      quiz_done: val.quizDone ?? false,
      last_score: val.lastScore ?? null,
      last_date: val.lastDate ?? null,
    }))
    if (rows.length > 0) {
      await supabase
        .from('daily_progress')
        .upsert(rows, { onConflict: 'user_id,day_number' })
    }
  }, [user])

  const loadProgressFromCloud = useCallback(async (): Promise<DailyProgressRecord | null> => {
    if (!user) return null
    const { data } = await supabase
      .from('daily_progress')
      .select('day_number, quiz_done, last_score, last_date')
      .eq('user_id', user.id)
    if (!data || data.length === 0) return null
    const record: DailyProgressRecord = {}
    data.forEach(row => {
      record[String(row.day_number)] = {
        quizDone: row.quiz_done,
        lastScore: row.last_score ?? undefined,
        lastDate: row.last_date ?? undefined,
      }
    })
    return record
  }, [user])

  return { syncProgressToCloud, loadProgressFromCloud }
}
