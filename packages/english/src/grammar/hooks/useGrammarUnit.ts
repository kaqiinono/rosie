'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@rosie/core'
import { parseGrammarUnitRow, type GrammarUnitDetail, type GrammarUnitRow } from '../types'

/** 单元内容是全局静态数据（所有用户相同），用模块级缓存而非 per-user store。 */
const cache = new Map<number, GrammarUnitDetail>()
const inflight = new Map<number, Promise<GrammarUnitDetail | null>>()

async function loadUnit(unitNumber: number): Promise<GrammarUnitDetail | null> {
  const hit = cache.get(unitNumber)
  if (hit) return hit
  const pending = inflight.get(unitNumber)
  if (pending) return pending
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('grammar_units')
        .select('*')
        .eq('unit_number', unitNumber)
        .maybeSingle()
      if (error || !data) return null
      const detail = parseGrammarUnitRow(data as GrammarUnitRow)
      cache.set(unitNumber, detail)
      return detail
    } catch {
      return null
    } finally {
      inflight.delete(unitNumber)
    }
  })()
  inflight.set(unitNumber, promise)
  return promise
}

export function useGrammarUnit(unitNumber: number) {
  // 只在 .then 回调里 setState（缓存命中时 loadUnit 也会异步微任务返回），避免 effect 内同步 setState
  const [result, setResult] = useState<{ for: number; detail: GrammarUnitDetail | null } | null>(() =>
    cache.has(unitNumber) ? { for: unitNumber, detail: cache.get(unitNumber) ?? null } : null,
  )

  useEffect(() => {
    let cancelled = false
    void loadUnit(unitNumber).then((detail) => {
      if (cancelled) return
      setResult({ for: unitNumber, detail })
    })
    return () => {
      cancelled = true
    }
  }, [unitNumber])

  const resolved = result !== null && result.for === unitNumber
  const cachedDetail = cache.get(unitNumber) ?? null
  const unit = resolved ? result.detail : cachedDetail
  const isLoading = !resolved && !cachedDetail
  const notFound = resolved && result.detail === null

  return { unit, isLoading, notFound }
}
