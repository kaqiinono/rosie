'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { todayStr } from '@rosie/core'

/** Lightweight write-only hook for English / Math / Calc modules to award stars. */
export function useStarEarning(user: User | null) {
  const earnStars = useCallback(
    async (source: 'english' | 'math' | 'calc', amount: number) => {
      if (!user || amount <= 0) return
      const { error } = await supabase.from('star_sessions').insert({
        user_id: user.id,
        date: todayStr(),
        source,
        coins_earned: amount,
      })
      if (error) {
        // Surface so RLS / constraint violations don't get silently swallowed.
        console.error('[star_sessions] insert failed', { source, amount, error })
      }
    },
    [user],
  )
  return { earnStars }
}
