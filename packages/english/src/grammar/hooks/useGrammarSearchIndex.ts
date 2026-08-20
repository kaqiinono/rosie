'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@rosie/core'

/**
 * 高级检索索引：全量 search_text 懒加载 + 模块级缓存。
 * 单元内容是全局静态数据（所有用户相同），不走 per-user session store
 * （同 useGrammarUnit 的 cache 模式）。key = `${book}:${unitNumber}`。
 */
const cache = new Map<string, string>()
let inflight: Promise<boolean> | null = null
let loaded = false

interface SearchIndexRow {
  book: string
  unit_number: number
  search_text: string | null
}

/** 拉取并填充缓存；成功返回 true，失败返回 false（loaded 不置位，下次可重试） */
async function loadIndex(): Promise<boolean> {
  // 迁移 0029 未应用时 select search_text 会 PGRST204 → 降级为空索引（前端提示未生成）
  const { data, error } = await supabase
    .from('grammar_units')
    .select('book, unit_number, search_text')
    .order('unit_number', { ascending: true })
  if (error) {
    console.warn('[grammar_search_index] fetch failed', error)
    return false
  }
  for (const row of (data ?? []) as unknown as SearchIndexRow[]) {
    if (typeof row.search_text === 'string' && row.search_text.trim()) {
      cache.set(`${row.book}:${row.unit_number}`, row.search_text)
    }
  }
  loaded = true
  return true
}

export interface GrammarSearchIndexState {
  isLoading: boolean
  /** 已发起过加载（用于首帧不闪现空态） */
  started: boolean
  /** 拉取失败（区别于「未回填」的空索引） */
  error: boolean
  /** 加载成功但无任何索引行（未回填/未迁移） */
  isEmpty: boolean
  load: () => Promise<Map<string, string>>
}

export function useGrammarSearchIndex(): GrammarSearchIndexState {
  const [isLoading, setIsLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  // useCallback 保证 load 引用稳定，供调用方放入 useEffect 依赖数组
  const load = useCallback(async () => {
    setStarted(true)
    setError(false) // 重试加载期间不残留上一轮失败态，避免闪现「加载失败」
    if (loaded) return cache
    if (!inflight) {
      inflight = loadIndex().finally(() => {
        inflight = null
      })
    }
    setIsLoading(true)
    try {
      const ok = await inflight
      setError(!ok)
      if (ok) setIsEmpty(cache.size === 0)
      return cache
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, started, error, isEmpty, load }
}
