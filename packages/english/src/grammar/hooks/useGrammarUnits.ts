'use client'

import { useEffect, useState } from 'react'
import type { GrammarBookId, GrammarUnitDetail } from '../types'
import { loadGrammarUnit } from './useGrammarUnit'

const DEFAULT_BOOK: GrammarBookId = 'essential'

/**
 * 批量加载延展位条目（补充练习/学习指导），复用 useGrammarUnit 的模块缓存。
 * numbers 变化时重新加载；缺失行（未入库）不出现在结果 Map 中。
 */
export function useGrammarUnits(numbers: number[] | undefined, book: GrammarBookId = DEFAULT_BOOK) {
  const key = numbers ? numbers.join(',') : ''
  const [result, setResult] = useState<{ for: string; units: Map<number, GrammarUnitDetail> }>({
    for: key,
    units: new Map(),
  })
  const [isLoading, setIsLoading] = useState(key !== '')

  useEffect(() => {
    if (!numbers || numbers.length === 0) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    void Promise.all(numbers.map((n) => loadGrammarUnit(book, n))).then((details) => {
      if (cancelled) return
      const map = new Map<number, GrammarUnitDetail>()
      details.forEach((d, i) => {
        if (d) map.set(numbers[i], d)
      })
      setResult({ for: numbers.join(','), units: map })
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // key 已涵盖 numbers 内容与顺序，避免数组字面量引用变化触发重复加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, book])

  return { units: result.for === key ? result.units : new Map<number, GrammarUnitDetail>(), isLoading }
}
