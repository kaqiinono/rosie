'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcSettings } from '@/utils/type'

const DEFAULT_SETTINGS: CalcSettings = {
  enableAddSub: true,
  enableMulDiv: true,
  enableMixed: true,
  levelCap: 12,
  currentLevel: 1,
  adaptive: true,
  soundEnabled: true,
  lastCount: 20,
  lastTimeLimit: 0,
}

interface RawRow {
  enable_addsub: boolean
  enable_muldiv: boolean
  enable_mixed: boolean
  level_cap: number
  current_level: number
  adaptive: boolean
  sound_enabled: boolean
  last_count: number
  last_time_limit: number
}

function rowToSettings(row: RawRow): CalcSettings {
  return {
    enableAddSub: row.enable_addsub,
    enableMulDiv: row.enable_muldiv,
    enableMixed: row.enable_mixed,
    levelCap: row.level_cap,
    currentLevel: row.current_level,
    adaptive: row.adaptive,
    soundEnabled: row.sound_enabled,
    lastCount: row.last_count,
    lastTimeLimit: row.last_time_limit,
  }
}

function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    enable_addsub: s.enableAddSub,
    enable_muldiv: s.enableMulDiv,
    enable_mixed: s.enableMixed,
    level_cap: s.levelCap,
    current_level: s.currentLevel,
    adaptive: s.adaptive,
    sound_enabled: s.soundEnabled,
    last_count: s.lastCount,
    last_time_limit: s.lastTimeLimit,
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
          'enable_addsub,enable_muldiv,enable_mixed,level_cap,current_level,adaptive,sound_enabled,last_count,last_time_limit',
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
