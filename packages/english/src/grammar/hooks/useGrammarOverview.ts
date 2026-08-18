'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import { GRAMMAR_INDEX } from '../grammar-index'
import {
  parseGrammarUnitRow,
  toSummary,
  type GrammarUnitRow,
  type GrammarUnitSummary,
} from '../types'

async function fetchGrammarUnits(): Promise<GrammarUnitSummary[]> {
  const { data, error } = await supabase
    .from('grammar_units')
    .select('unit_number,title,title_zh,category,category_zh,difficulty,book_pages')
    .order('unit_number', { ascending: true })
  if (error) {
    console.error('[grammar_units] fetch failed', error)
    return []
  }
  return (data ?? []).map((row) => toSummary(parseGrammarUnitRow(row as GrammarUnitRow)))
}

export const grammarUnitsStore = createUserSessionStore<GrammarUnitSummary[]>('grammar_units', {
  fetch: fetchGrammarUnits,
  empty: [],
})

export interface GrammarOverviewEntry extends GrammarUnitSummary {
  locked: boolean
}

/**
 * 首页单元地图：静态索引（Phase 2 后）与 DB 已入库单元合并。
 * 索引为空时（Phase 1）降级为仅展示已入库单元。
 */
export function useGrammarOverview(user: User | null) {
  const { data: unlocked, isLoading } = grammarUnitsStore.useSessionData(user)

  const entries = useMemo<GrammarOverviewEntry[]>(() => {
    if (GRAMMAR_INDEX.length === 0) return unlocked.map((u) => ({ ...u, locked: false }))
    const unlockedMap = new Map(unlocked.map((u) => [u.unitNumber, u]))
    return GRAMMAR_INDEX.map((idx) => {
      const u = unlockedMap.get(idx.unitNumber)
      if (u) return { ...u, locked: false }
      return {
        unitNumber: idx.unitNumber,
        title: idx.title,
        titleZh: idx.titleZh,
        category: idx.category,
        categoryZh: idx.categoryZh,
        difficulty: 0,
        bookPages: idx.bookPages,
        locked: true,
      }
    })
  }, [unlocked])

  return {
    entries,
    unlockedCount: unlocked.length,
    totalCount: GRAMMAR_INDEX.length || unlocked.length,
    isLoading,
  }
}
