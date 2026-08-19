'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@rosie/core'
import { parseGrammarUnitRow, type GrammarBookId, type GrammarUnitDetail, type GrammarUnitRow } from '../types'

/** 单元内容是全局静态数据（所有用户相同），用模块级缓存而非 per-user store。key = `${book}:${unitNumber}` */
const cache = new Map<string, GrammarUnitDetail>()
const inflight = new Map<string, Promise<GrammarUnitDetail | null>>()

/** admin 变更（插图插入/删除）后直接写模块缓存，使后续读取立即生效 */
export function patchGrammarUnitCache(book: GrammarBookId, unitNumber: number, detail: GrammarUnitDetail): void {
  cache.set(`${book}:${unitNumber}`, detail)
}

export async function loadGrammarUnit(book: GrammarBookId, unitNumber: number): Promise<GrammarUnitDetail | null> {
  const cacheKey = `${book}:${unitNumber}`
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const pending = inflight.get(cacheKey)
  if (pending) return pending
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('grammar_units')
        .select('*')
        .eq('book', book)
        .eq('unit_number', unitNumber)
        .maybeSingle()
      if (error || !data) return null
      const detail = parseGrammarUnitRow(data as GrammarUnitRow)
      cache.set(cacheKey, detail)
      return detail
    } catch {
      return null
    } finally {
      inflight.delete(cacheKey)
    }
  })()
  inflight.set(cacheKey, promise)
  return promise
}

const DEFAULT_BOOK: GrammarBookId = 'essential'

export function useGrammarUnit(unitNumber: number, book: GrammarBookId = DEFAULT_BOOK) {
  const cacheKey = `${book}:${unitNumber}`
  // 只在 .then 回调里 setState（缓存命中时 loadUnit 也会异步微任务返回），避免 effect 内同步 setState
  const [result, setResult] = useState<{ for: string; detail: GrammarUnitDetail | null } | null>(() =>
    cache.has(cacheKey) ? { for: cacheKey, detail: cache.get(cacheKey) ?? null } : null,
  )

  useEffect(() => {
    let cancelled = false
    void loadGrammarUnit(book, unitNumber).then((detail) => {
      if (cancelled) return
      setResult({ for: cacheKey, detail })
    })
    return () => {
      cancelled = true
    }
  }, [book, unitNumber, cacheKey])

  const resolved = result !== null && result.for === cacheKey
  const cachedDetail = cache.get(cacheKey) ?? null
  const unit = resolved ? result.detail : cachedDetail
  const isLoading = !resolved && !cachedDetail
  const notFound = resolved && result.detail === null

  return { unit, isLoading, notFound }
}
