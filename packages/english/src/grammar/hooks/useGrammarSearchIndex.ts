'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@rosie/core'

/**
 * 高级检索索引：全量 search_text 懒加载 + 模块级缓存。
 * 单元内容是全局静态数据（所有用户相同），不走 per-user session store
 * （同 useGrammarUnit 的 cache 模式）。key = `${book}:${unitNumber}`。
 */
const cache = new Map<string, string>()
let inflight: Promise<Map<string, string>> | null = null
let loaded = false

interface SearchIndexRow {
  book: string
  unit_number: number
  search_text: string | null
}

async function loadIndex(): Promise<Map<string, string>> {
  // 迁移 0029 未应用时 select search_text 会 PGRST204 → 返回空索引（前端降级提示）
  const { data, error } = await supabase
    .from('grammar_units')
    .select('book, unit_number, search_text')
    .order('unit_number', { ascending: true })
  if (error) {
    console.warn('[grammar_search_index] fetch failed', error)
    return cache
  }
  for (const row of (data ?? []) as unknown as SearchIndexRow[]) {
    if (typeof row.search_text === 'string' && row.search_text.trim()) {
      cache.set(`${row.book}:${row.unit_number}`, row.search_text)
    }
  }
  loaded = true
  return cache
}

export interface GrammarSearchIndexState {
  isLoading: boolean
  /** 加载成功但无任何索引行（未回填/未迁移） */
  isEmpty: boolean
  load: () => Promise<Map<string, string>>
}

export function useGrammarSearchIndex(): GrammarSearchIndexState {
  const [isLoading, setIsLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const load = useCallback(async () => {
    if (loaded) return cache
    if (!inflight) {
      inflight = loadIndex().finally(() => {
        inflight = null
      })
    }
    setIsLoading(true)
    try {
      const result = await inflight
      setIsEmpty(result.size === 0)
      return result
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, isEmpty, load }
}
