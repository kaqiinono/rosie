'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { BlockSel, CalcSettings, MixedOp } from '@rosie/core'
import { normalizeSelectedBlocks } from '../utils/calc-settings-normalize'

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
    selectedBlocks: normalizeSelectedBlocks((row.selected_blocks ?? ['add:10']).map(toBlockSel)),
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

async function fetchCalcSettings(userId: string): Promise<CalcSettings> {
  const { data } = await supabase
    .from('calc_settings')
    .select(
      'count_mode,selected_blocks,mixed_ops,sound_enabled,last_count,session_counter,include_inverse,vertical_for_big_numbers,timed_answer_enabled,immersive_mode',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return rowToSettings(data as RawRow)
  return DEFAULT_SETTINGS
}

export const calcSettingsStore = createUserSessionStore<CalcSettings>('calc_settings', {
  fetch: fetchCalcSettings,
  empty: DEFAULT_SETTINGS,
})

export function useCalcSettings(user: User | null) {
  const { data: settings, isLoading } = calcSettingsStore.useSessionData(user)

  const persist = useCallback(
    async (next: CalcSettings) => {
      if (!user) return
      const normalized = { ...next, selectedBlocks: normalizeSelectedBlocks(next.selectedBlocks) }
      calcSettingsStore.replaceSessionData(user.id, normalized)
      try {
        await supabase
          .from('calc_settings')
          .upsert(settingsToRow(normalized, user.id), { onConflict: 'user_id' })
      } catch {
        /* ignore */
      }
    },
    [user],
  )

  const update = useCallback(
    (patch: Partial<CalcSettings>) => {
      if (!user) return
      calcSettingsStore.patchSessionData(user.id, (prev) => {
        const next = { ...prev, ...patch }
        const normalized = { ...next, selectedBlocks: normalizeSelectedBlocks(next.selectedBlocks) }
        void supabase
          .from('calc_settings')
          .upsert(settingsToRow(normalized, user.id), { onConflict: 'user_id' })
          .then(() => {})
        return normalized
      })
    },
    [user],
  )

  return { settings, setSettings: persist, update, isLoading }
}
