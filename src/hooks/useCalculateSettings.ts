'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalculateSettings, LevelId, TreeId } from '@/utils/calculate-types'
import { getInitialUnlockedLevels } from '@/utils/calculate-trees'

const DEFAULT_SETTINGS: CalculateSettings = {
  userId: '',
  unlockedLevels: getInitialUnlockedLevels(),
  thetaPerTree: {} as Record<TreeId, number>,
  soundEnabled: true,
  focusMode: false,
  dailyTarget: 20,
  createdAt: '',
  updatedAt: '',
}

interface RawRow {
  user_id: string
  unlocked_levels: string[]
  theta_per_tree: Record<string, number>
  sound_enabled: boolean
  focus_mode?: boolean
  daily_target: number
  created_at: string
  updated_at: string
}

function rowToSettings(row: RawRow): CalculateSettings {
  return {
    userId: row.user_id,
    unlockedLevels: row.unlocked_levels as LevelId[],
    thetaPerTree: row.theta_per_tree as Record<TreeId, number>,
    soundEnabled: row.sound_enabled,
    focusMode: row.focus_mode ?? false,
    dailyTarget: row.daily_target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function settingsToRow(s: CalculateSettings, userId: string) {
  return {
    user_id: userId,
    unlocked_levels: s.unlockedLevels,
    theta_per_tree: s.thetaPerTree,
    sound_enabled: s.soundEnabled,
    focus_mode: s.focusMode,
    daily_target: s.dailyTarget,
    updated_at: new Date().toISOString(),
  }
}

export function useCalculateSettings(user: User | null) {
  const [settings, setSettings] = useState<CalculateSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calculate_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setSettings(rowToSettings(data as RawRow))
      }
      setIsLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [user])

  const update = useCallback(
    (patch: Partial<CalculateSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        if (user) {
          void supabase
            .from('calculate_settings')
            .upsert(settingsToRow(next, user.id), { onConflict: 'user_id' })
            .then(() => {})
        }
        return next
      })
    },
    [user],
  )

  return { settings, update, isLoading }
}
