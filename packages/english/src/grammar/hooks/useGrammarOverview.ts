'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import { GRAMMAR_INDEX } from '../grammar-index'
import {
  parseGrammarUnitRow,
  toSummary,
  type GrammarBookId,
  type GrammarUnitRow,
  type GrammarUnitSummary,
} from '../types'

const BASE_SELECT = 'book,unit_number,title,title_zh,category,category_zh,difficulty,book_pages'
// 迁移 0028 新增列；未应用时扩展 select 会 400，回退基础列保证首页可用
const EXTENDED_SELECT = `${BASE_SELECT},units,supp_entries,study_guide_units`

async function fetchGrammarUnits(book: GrammarBookId): Promise<GrammarUnitSummary[]> {
  const query = async (select: string): Promise<GrammarUnitRow[] | null> => {
    const { data, error } = await supabase
      .from('grammar_units')
      .select(select)
      .eq('book', book)
      .order('unit_number', { ascending: true })
    if (error) {
      console.error('[grammar_units] fetch failed', error)
      return null
    }
    return (data ?? []) as unknown as GrammarUnitRow[]
  }
  // 扩展列缺失（迁移 0028 未应用，PGRST204/42703）时降级为基础列重试
  const rows = (await query(EXTENDED_SELECT)) ?? (await query(BASE_SELECT))
  if (!rows) return []
  return rows.map((row) => toSummary(parseGrammarUnitRow(row)))
}

/** 每本书一个 session store（key 区分），首访惰性创建 */
const storesByBook = new Map<GrammarBookId, ReturnType<typeof createGrammarUnitsStore>>()

function createGrammarUnitsStore(book: GrammarBookId) {
  return createUserSessionStore<GrammarUnitSummary[]>(`grammar_units:${book}`, {
    fetch: () => fetchGrammarUnits(book),
    empty: [],
  })
}

export function getGrammarUnitsStore(book: GrammarBookId) {
  let store = storesByBook.get(book)
  if (!store) {
    store = createGrammarUnitsStore(book)
    storesByBook.set(book, store)
  }
  return store
}

/** 跨书全量摘要（不带 book 过滤）：书籍列表页进度统计与全局检索共用 */
async function fetchAllGrammarUnits(): Promise<GrammarUnitSummary[]> {
  const query = async (select: string): Promise<GrammarUnitRow[] | null> => {
    const { data, error } = await supabase
      .from('grammar_units')
      .select(select)
      .order('book', { ascending: true })
      .order('unit_number', { ascending: true })
    if (error) {
      console.error('[grammar_units:all] fetch failed', error)
      return null
    }
    return (data ?? []) as unknown as GrammarUnitRow[]
  }
  const rows = (await query(EXTENDED_SELECT)) ?? (await query(BASE_SELECT))
  if (!rows) return []
  return rows.map((row) => toSummary(parseGrammarUnitRow(row)))
}

export const grammarAllUnitsStore = createUserSessionStore<GrammarUnitSummary[]>(
  'grammar_units:all',
  { fetch: fetchAllGrammarUnits, empty: [] },
)

export function useGrammarAllUnits(user: User | null) {
  const { data: entries, isLoading } = grammarAllUnitsStore.useSessionData(user)
  return { entries, isLoading }
}

export interface GrammarOverviewEntry extends GrammarUnitSummary {
  locked: boolean
}

/**
 * 书内单元地图：静态索引（Phase 2 后）与 DB 已入库单元合并。
 * 索引为空时（Phase 1）降级为仅展示已入库单元。
 */
export function useGrammarOverview(user: User | null, book: GrammarBookId = 'essential') {
  const store = getGrammarUnitsStore(book)
  const { data: unlocked, isLoading } = store.useSessionData(user)

  const bookIndex = useMemo(() => GRAMMAR_INDEX.filter((e) => e.book === book), [book])

  const entries = useMemo<GrammarOverviewEntry[]>(() => {
    if (bookIndex.length === 0) return unlocked.map((u) => ({ ...u, locked: false }))
    const unlockedMap = new Map(unlocked.map((u) => [u.unitNumber, u]))
    const mapped = bookIndex.map((idx) => {
      const u = unlockedMap.get(idx.unitNumber)
      if (u) return { ...u, locked: false }
      return {
        book: idx.book,
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
    // 索引外的已入库行（书尾延展位 116-169：附录/补充练习/学习指导）追加展示
    const indexed = new Set(bookIndex.map((idx) => idx.unitNumber))
    const extra = unlocked
      .filter((u) => !indexed.has(u.unitNumber))
      .map((u) => ({ ...u, locked: false }))
    return [...mapped, ...extra]
  }, [unlocked, bookIndex])

  return {
    entries,
    unlockedCount: unlocked.length,
    totalCount: bookIndex.length || unlocked.length,
    isLoading,
  }
}
