'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { todayStr } from '@rosie/core'

/**
 * Lightweight write-only hook for English / Math / Calc modules to award stars.
 * Resolves `true` only when the insert actually succeeded — callers that surface
 * a success toast must branch on this, otherwise RLS/constraint failures get
 * reported as "added" while the balance stays unchanged.
 */
export function useStarEarning(user: User | null) {
  const earnStars = useCallback(
    async (source: 'english' | 'math' | 'calc', amount: number): Promise<boolean> => {
      if (!user || amount <= 0) return false
      const { error } = await supabase.from('star_sessions').insert({
        user_id: user.id,
        date: todayStr(),
        source,
        coins_earned: amount,
      })
      if (error) {
        // Surface so RLS / constraint violations don't get silently swallowed.
        console.error('[star_sessions] insert failed', { source, amount, error })
        return false
      }
      return true
    },
    [user],
  )
  return { earnStars }
}
