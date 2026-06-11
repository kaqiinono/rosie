'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CalcSettings, MixedOp } from '@/utils/type'

const DEFAULT_SETTINGS: CalcSettings = {
  selectedBlocks: ['add:10'],
  mixedOps: [],
  soundEnabled: true,
  lastCount: 20,
  lastTimeLimit: 0,
  sessionCounter: 0,
  timeLimitOverrides: {},
}

interface RawRow {
  selected_blocks: string[] | null
  mixed_ops: MixedOp[] | null
  sound_enabled: boolean
  last_count: number
  last_time_limit: number
  session_counter: number | null
  time_limit_overrides: Record<string, number> | null
}

function rowToSettings(row: RawRow): CalcSettings {
  return {
    selectedBlocks: row.selected_blocks ?? ['add:10'],
    mixedOps: row.mixed_ops ?? [],
    soundEnabled: row.sound_enabled,
    lastCount: row.last_count,
    lastTimeLimit: row.last_time_limit,
    sessionCounter: row.session_counter ?? 0,
    timeLimitOverrides: row.time_limit_overrides ?? {},
  }
}

function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    selected_blocks: s.selectedBlocks,
    mixed_ops: s.mixedOps,
    sound_enabled: s.soundEnabled,
    last_count: s.lastCount,
    last_time_limit: s.lastTimeLimit,
    session_counter: s.sessionCounter,
    time_limit_overrides: s.timeLimitOverrides,
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
          'selected_blocks,mixed_ops,sound_enabled,last_count,last_time_limit,session_counter,time_limit_overrides',
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
