'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { BlockSel, CalcSettings, MixedOp } from '@rosie/core'

const DEFAULT_BLOCK: BlockSel = { id: 'add:10', count: 20, seconds: 0 }

const DEFAULT_SETTINGS: CalcSettings = {
  countMode: 'auto',
  selectedBlocks: [DEFAULT_BLOCK],
  mixedOps: [],
  soundEnabled: true,
  includeInverse: false,
  verticalForBigNumbers: true,
  timedAnswerEnabled: false,
  immersiveMode: false,
  lastCount: 20,
  sessionCounter: 0,
}

interface RawRow {
  count_mode: 'auto' | 'manual' | null
  selected_blocks: (string | BlockSel)[] | null
  mixed_ops: Partial<MixedOp>[] | null
  sound_enabled: boolean
  include_inverse: boolean | null
  vertical_for_big_numbers: boolean | null
  timed_answer_enabled: boolean | null
  immersive_mode: boolean | null
  last_count: number
  session_counter: number | null
}

/** Accept both legacy string ids and the new object shape. seconds 默认 0(不限). */
function toBlockSel(v: string | BlockSel): BlockSel {
  if (typeof v === 'string') return { id: v, count: 20, seconds: 0 }
  return { id: v.id, count: v.count ?? 20, seconds: v.seconds ?? 0 }
}

function toMixedOp(v: Partial<MixedOp>): MixedOp {
  return {
    id: v.id ?? crypto.randomUUID(),
    skeleton: v.skeleton!,
    blockIds: v.blockIds ?? [],
    enabled: v.enabled ?? true,
    label: v.label,
    count: v.count ?? 20,
    seconds: v.seconds ?? 0,
  }
}

function rowToSettings(row: RawRow): CalcSettings {
  return {
    countMode: row.count_mode ?? 'auto',
    selectedBlocks: (row.selected_blocks ?? ['add:10']).map(toBlockSel),
    mixedOps: (row.mixed_ops ?? []).map(toMixedOp),
    soundEnabled: row.sound_enabled,
    includeInverse: row.include_inverse ?? false,
    verticalForBigNumbers: row.vertical_for_big_numbers ?? true,
    timedAnswerEnabled: row.timed_answer_enabled ?? false,
    immersiveMode: row.immersive_mode ?? false,
    lastCount: row.last_count,
    sessionCounter: row.session_counter ?? 0,
  }
}

function settingsToRow(s: CalcSettings, userId: string) {
  return {
    user_id: userId,
    count_mode: s.countMode,
    selected_blocks: s.selectedBlocks,
    mixed_ops: s.mixedOps,
    sound_enabled: s.soundEnabled,
    include_inverse: s.includeInverse,
    vertical_for_big_numbers: s.verticalForBigNumbers,
    timed_answer_enabled: s.timedAnswerEnabled,
    immersive_mode: s.immersiveMode,
    last_count: s.lastCount,
    session_counter: s.sessionCounter,
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
          'count_mode,selected_blocks,mixed_ops,sound_enabled,last_count,session_counter,include_inverse,vertical_for_big_numbers,timed_answer_enabled,immersive_mode',
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
