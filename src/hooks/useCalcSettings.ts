'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcLevel, CalcSettings } from '@/utils/type'

const DEFAULT_SETTINGS: CalcSettings = {
  enableAddSub: true,
  enableMulDiv: true,
  enableMixed: true,
  currentLevel: 1,
  adaptive: true,
  soundEnabled: true,
  lastCount: 20,
  lastTimeLimit: 0,
  sessionCounter: 0,
  timeLimitOverrides: {},
  freeMode: false,
  freeModeLevels: [],
}

interface RawRow {
  enable_addsub: boolean
  enable_muldiv: boolean
  enable_mixed: boolean
  current_level: number
  adaptive: boolean
  sound_enabled: boolean
  last_count: number
  last_time_limit: number
  session_counter: number | null
  time_limit_overrides: Record<string, number> | null
  free_mode: boolean | null
  free_mode_levels: CalcLevel[] | null
}

function rowToSettings(row: RawRow): CalcSettings {
  return {
    enableAddSub: row.enable_addsub,
    enableMulDiv: row.enable_muldiv,
    enableMixed: row.enable_mixed,
    currentLevel: row.current_level,
    adaptive: row.adaptive,
    soundEnabled: row.sound_enabled,
    lastCount: row.last_count,
    lastTimeLimit: row.last_time_limit,
    sessionCounter: row.session_counter ?? 0,
    timeLimitOverrides: row.time_limit_overrides ?? {},
    freeMode: row.free_mode ?? false,
    freeModeLevels: row.free_mode_levels ?? [],
  }
}

function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    enable_addsub: s.enableAddSub,
    enable_muldiv: s.enableMulDiv,
    enable_mixed: s.enableMixed,
    current_level: s.currentLevel,
    adaptive: s.adaptive,
    sound_enabled: s.soundEnabled,
    last_count: s.lastCount,
    last_time_limit: s.lastTimeLimit,
    session_counter: s.sessionCounter,
    time_limit_overrides: s.timeLimitOverrides,
    free_mode: s.freeMode,
    free_mode_levels: s.freeModeLevels,
    updated_at: new Date().toISOString(),
  }
}

export function useCalcSettings(user: User | null) {
  const [settings, setSettings] = useState<CalcSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(() => user !== null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const init = async () => {
      const { data } = await supabase
        .from('calc_settings')
        .select(
          'enable_addsub,enable_muldiv,enable_mixed,current_level,adaptive,sound_enabled,last_count,last_time_limit,session_counter,time_limit_overrides,free_mode,free_mode_levels',
        )
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) setSettings(rowToSettings(data as RawRow))
      setIsLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [user])

  const persist = useCallback(
    async (next: CalcSettings) => {
      setSettings(next)
      if (!user) return
      try {
        await supabase
          .from('calc_settings')
          .upsert(settingsToRow(next, user.id), { onConflict: 'user_id' })
      } catch {
        /* ignore */
      }
    },
    [user],
  )

  const update = useCallback(
    (patch: Partial<CalcSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        if (user) {
          void supabase
            .from('calc_settings')
            .upsert(settingsToRow(next, user.id), { onConflict: 'user_id' })
            .then(() => {})
        }
        return next
      })
    },
    [user],
  )

  return { settings, setSettings: persist, update, isLoading }
}
