'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { MAX_NUMERIC_LEVEL } from '@/utils/calc-levels'
import type { CalcSettings } from '@/utils/type'

/**
 * Hook for advancing the user's current level after a session ends.
 * Caller passes most recent session stats (firstTryCorrect / totalAtLevel).
 */
export function useCalcLevel(
  user: User | null,
  settings: CalcSettings,
  updateSettings: (patch: Partial<CalcSettings>) => void,
) {
  /** Returns the new currentLevel; updates settings + supabase if advanced. */
  const checkAndAdvance = useCallback(
    async (recentAtLevel: { firstTryCorrect: number; total: number }): Promise<number> => {
      if (!settings.adaptive) return settings.currentLevel
      if (settings.currentLevel >= MAX_NUMERIC_LEVEL) return settings.currentLevel
      if (recentAtLevel.total < 30) return settings.currentLevel
      const accuracy = recentAtLevel.firstTryCorrect / recentAtLevel.total
      if (accuracy < 0.85) return settings.currentLevel

      const next = Math.min(settings.currentLevel + 1, MAX_NUMERIC_LEVEL)
      updateSettings({ currentLevel: next })
      if (user) {
        try {
          await supabase
            .from('calc_settings')
            .update({ current_level: next, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
        } catch {
          /* ignore */
        }
      }
      return next
    },
    [settings.adaptive, settings.currentLevel, updateSettings, user],
  )

  return { currentLevel: settings.currentLevel, checkAndAdvance }
}
