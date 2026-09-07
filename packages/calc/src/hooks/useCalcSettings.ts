'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { BlockSel, CalcSettings, CalcTimingMode, MixedOp } from '@rosie/core'
import { clampBonusSec } from '../utils/calc-session-policy'
import { normalizeMixedOps, normalizeSelectedBlocks } from '../utils/calc-settings-normalize'
import { allocatePercentages } from '../utils/calc-helpers'

const TIMING_MODES: CalcTimingMode[] = ['relaxed', 'strict', 'bonus']

function parseTimingMode(raw: string | null | undefined): CalcTimingMode {
  if (raw && (TIMING_MODES as string[]).includes(raw)) return raw as CalcTimingMode
  return 'relaxed'
}

export const DEFAULT_CALC_SETTINGS: CalcSettings = {
  countMode: 'auto',
  selectedBlocks: [{ id: 'add:10', count: 100, seconds: 0 }],
  mixedOps: [],
  soundEnabled: true,
  includeInverse: false,
  verticalForBigNumbers: true,
  timedAnswerEnabled: false,
  immersiveMode: false,
  lastCount: 20,
  sessionCounter: 0,
  timingMode: 'relaxed',
  bonusSec: 3,
  autoSubmitOnMatch: true,
  adaptiveExpansionEnabled: false,
}

interface RawRow {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  timing_mode: string | null
  bonus_sec: number | null
  auto_submit_on_match: boolean | null
  adaptive_expansion_enabled: boolean | null
}

export interface CalcStrategy {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  settings: CalcSettings
}

const STRATEGY_COLUMNS =
  'id,name,is_active,created_at,updated_at,count_mode,selected_blocks,mixed_ops,sound_enabled,last_count,session_counter,include_inverse,vertical_for_big_numbers,timed_answer_enabled,immersive_mode,timing_mode,bonus_sec,auto_submit_on_match,adaptive_expansion_enabled'

function toBlockSel(v: string | BlockSel): BlockSel {
  if (typeof v === 'string') return { id: v, count: 100, seconds: 0 }
  return { id: v.id, count: v.count ?? 100, seconds: v.seconds ?? 0 }
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

export function normalizeCalcSettings(next: CalcSettings): CalcSettings {
  const selectedBlocks = normalizeSelectedBlocks(next.selectedBlocks).map((block) => ({ ...block }))
  const mixedOps = normalizeMixedOps(next.mixedOps).map((operation) => ({
    ...operation,
    blockIds: [...operation.blockIds],
  }))
  if (next.countMode === 'manual') {
    const enabledMixed = mixedOps.filter((operation) => operation.enabled)
    const normalized = allocatePercentages(100, [
      ...selectedBlocks.map((block) => block.count),
      ...enabledMixed.map((operation) => operation.count),
    ])
    selectedBlocks.forEach((block, index) => {
      block.count = normalized[index] ?? 1
    })
    enabledMixed.forEach((operation, index) => {
      operation.count = normalized[selectedBlocks.length + index] ?? 1
    })
  }
  return {
    ...next,
    selectedBlocks,
    mixedOps,
    timingMode: parseTimingMode(next.timingMode),
    bonusSec: clampBonusSec(next.bonusSec),
  }
}

function rowToSettings(row: RawRow): CalcSettings {
  return normalizeCalcSettings({
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
    timingMode: parseTimingMode(row.timing_mode),
    bonusSec: clampBonusSec(row.bonus_sec ?? 3),
    autoSubmitOnMatch: row.auto_submit_on_match ?? true,
    adaptiveExpansionEnabled: row.adaptive_expansion_enabled ?? false,
  })
}

function rowToStrategy(row: RawRow): CalcStrategy {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: rowToSettings(row),
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
    timing_mode: s.timingMode,
    bonus_sec: s.bonusSec,
    auto_submit_on_match: s.autoSubmitOnMatch,
    adaptive_expansion_enabled: s.adaptiveExpansionEnabled,
    updated_at: new Date().toISOString(),
  }
}

async function fetchCalcSettings(userId: string): Promise<CalcSettings> {
  const { data, error } = await supabase
    .from('calc_settings')
    .select(STRATEGY_COLUMNS)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data ? rowToSettings(data as RawRow) : DEFAULT_CALC_SETTINGS
}

async function fetchCalcStrategies(userId: string): Promise<CalcStrategy[]> {
  const { data, error } = await supabase
    .from('calc_settings')
    .select(STRATEGY_COLUMNS)
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as RawRow[]).map(rowToStrategy)
}

export const calcSettingsStore = createUserSessionStore<CalcSettings>('calc_settings', {
  fetch: fetchCalcSettings,
  empty: DEFAULT_CALC_SETTINGS,
})

export const calcStrategiesStore = createUserSessionStore<CalcStrategy[]>('calc_strategies', {
  fetch: fetchCalcStrategies,
  empty: [],
})

async function refreshStores(userId: string): Promise<void> {
  await Promise.all([
    calcSettingsStore.refreshInBackground(userId),
    calcStrategiesStore.refreshInBackground(userId),
  ])
}

export function useCalcSettings(user: User | null) {
  const { data: settings, isLoading, error } = calcSettingsStore.useSessionData(user)

  const persist = useCallback(
    async (next: CalcSettings) => {
      if (!user) return
      const normalized = normalizeCalcSettings(next)
      const { data: active, error: findError } = await supabase
        .from('calc_settings')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (findError) throw findError

      if (active) {
        const { error: updateError } = await supabase
          .from('calc_settings')
          .update(settingsToRow(normalized, user.id))
          .eq('id', active.id)
          .eq('user_id', user.id)
        if (updateError) throw updateError
      } else {
        // A user may intentionally disable every named strategy. Practice can
        // still use the built-in fallback without silently re-enabling one.
        calcSettingsStore.replaceSessionData(user.id, normalized)
        return
      }
      calcSettingsStore.replaceSessionData(user.id, normalized)
      await calcStrategiesStore.refreshInBackground(user.id)
    },
    [user],
  )

  const update = useCallback(
    (patch: Partial<CalcSettings>) => {
      if (!user) return
      calcSettingsStore.patchSessionData(user.id, (prev) => {
        const normalized = normalizeCalcSettings({ ...prev, ...patch })
        void persist(normalized).catch((persistError: unknown) => {
          console.error('[calc_settings] update failed', persistError)
          void calcSettingsStore.refreshInBackground(user.id)
        })
        return normalized
      })
    },
    [persist, user],
  )

  return { settings, setSettings: persist, update, isLoading, error }
}

export function useCalcStrategies(user: User | null) {
  const { data: strategies, isLoading, error } = calcStrategiesStore.useSessionData(user)

  const createStrategy = useCallback(
    async (name: string, settings: CalcSettings): Promise<string> => {
      if (!user) throw new Error('请先登录')
      const normalizedName = name.trim()
      if (!normalizedName) throw new Error('请输入策略名称')
      const { data, error: insertError } = await supabase
        .from('calc_settings')
        .insert({
          ...settingsToRow(normalizeCalcSettings(settings), user.id),
          name: normalizedName,
          // Never infer activation from the client cache. An existing active
          // row may have been created in another tab or before schema reload.
          is_active: false,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const strategyId = data.id as string
      const { data: active, error: activeError } = await supabase
        .from('calc_settings')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (activeError) throw activeError

      // The first strategy becomes the default. The RPC serializes activation,
      // so simultaneous creates still finish with exactly one active row.
      if (!active) {
        const { error: activateError } = await supabase.rpc('set_calc_strategy_enabled', {
          strategy_id: strategyId,
          enabled: true,
        })
        if (activateError) throw activateError
      }
      await refreshStores(user.id)
      return strategyId
    },
    [user],
  )

  const saveStrategy = useCallback(
    async (id: string, name: string, settings: CalcSettings): Promise<void> => {
      if (!user) throw new Error('请先登录')
      const normalizedName = name.trim()
      if (!normalizedName) throw new Error('请输入策略名称')
      const { error: updateError } = await supabase
        .from('calc_settings')
        .update({ ...settingsToRow(normalizeCalcSettings(settings), user.id), name: normalizedName })
        .eq('id', id)
        .eq('user_id', user.id)
      if (updateError) throw updateError
      await refreshStores(user.id)
    },
    [user],
  )

  const setStrategyEnabled = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      if (!user) throw new Error('请先登录')
      const { error: rpcError } = await supabase.rpc('set_calc_strategy_enabled', {
        strategy_id: id,
        enabled,
      })
      if (rpcError) throw rpcError
      await refreshStores(user.id)
    },
    [user],
  )

  const deleteStrategy = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('请先登录')
      const { error: rpcError } = await supabase.rpc('delete_calc_strategy', { strategy_id: id })
      if (rpcError) throw rpcError
      await refreshStores(user.id)
    },
    [user],
  )

  return {
    strategies,
    createStrategy,
    saveStrategy,
    setStrategyEnabled,
    deleteStrategy,
    isLoading,
    error,
  }
}
