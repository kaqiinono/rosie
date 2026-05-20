'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { todayStr } from '@/utils/constant'

/** Lightweight write-only hook for English / Math modules to award stars. */
export function useStarEarning(user: User | null) {
  const earnStars = useCallback(
    async (source: 'english' | 'math', amount: number) => {
      if (!user || amount <= 0) return
      try {
        await supabase.from('star_sessions').insert({
          user_id: user.id,
          date: todayStr(),
          source,
          coins_earned: amount,
        })
      } catch { /* ignore — table may not exist before migration */ }
    },
    [user],
  )
  return { earnStars }
}
