'use client'

import { useMemo } from 'react'
import { useAuth } from '@rosie/core'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { useCalcMistakes, categoryLabel, formatAnswer } from '@rosie/calc'
import { useEnglishWrong, useWordData, findWordByKey, practiceHrefForWord } from '@rosie/english'
import { lookupMathProblem } from '@rosie/math/utils/math-problem-lookup'
import type { CalcMistake } from '@rosie/core'

export type MistakeModule = 'math' | 'calc' | 'english'
export type MistakeStatus = 'unresolved' | 'resolved'
export type MistakeStatusFilter = 'unresolved' | 'resolved' | 'all'
export type MistakeModuleFilter = 'all' | MistakeModule

export type UnifiedMistakeItem = {
  id: string
  module: MistakeModule
  status: MistakeStatus
  title: string
  subtitle: string
  href: string
  lastWrongAt: string
  resolvedAt: string | null
}

const MODULE_LABEL: Record<MistakeModule, string> = {
  math: '数学',
  calc: '口算',
  english: '英语',
}

export { MODULE_LABEL }

export function useUnifiedMistakes() {
  const { user } = useAuth()
  const { rows: mathRows, refetchWrong } = useMathWrong(user)
  const { mistakes: calcMistakes, isLoading: calcLoading, refresh: refreshCalc } =
    useCalcMistakes(user)
  const { rows: englishRows, refetch: refetchEnglish } = useEnglishWrong(user)
  const { vocab } = useWordData(user)

  const items = useMemo((): UnifiedMistakeItem[] => {
    const mathItems: UnifiedMistakeItem[] = mathRows.flatMap((row) => {
      const lookup = lookupMathProblem(row.problemId)
      if (!lookup) return []
      return [
        {
          id: `math::${row.problemId}`,
          module: 'math' as const,
          status: row.resolved ? ('resolved' as const) : ('unresolved' as const),
          title: lookup.title,
          subtitle: `${lookup.lessonLabel} · ${lookup.sectionLabel}`,
          href: lookup.href,
          lastWrongAt: row.addedAt,
          resolvedAt: row.resolvedAt,
        },
      ]
    })

    const calcItems: UnifiedMistakeItem[] = calcMistakes.map((m: CalcMistake) => {
      const display = m.display.replace(/\s*=\s*\?\s*$/, '')
      return {
        id: `calc::${m.signature}`,
        module: 'calc' as const,
        status: m.resolved ? ('resolved' as const) : ('unresolved' as const),
        title: `${display} = ${formatAnswer(m.answer)}`,
        subtitle: categoryLabel(m.category),
        href: '/calc/session?mode=mistakes&count=3&time=0',
        lastWrongAt: m.lastWrongAt,
        resolvedAt: m.resolved ? m.lastWrongAt : null,
      }
    })

    const englishItems: UnifiedMistakeItem[] = englishRows.flatMap((row) => {
      const entry = findWordByKey(vocab, row.wordKey)
      if (!entry) return []
      return [
        {
          id: `english::${row.wordKey}`,
          module: 'english' as const,
          status: row.resolved ? ('resolved' as const) : ('unresolved' as const),
          title: entry.word,
          subtitle: `${entry.unit} · ${entry.lesson} · ${entry.explanation}`,
          href: practiceHrefForWord(row.wordKey),
          lastWrongAt: row.addedAt,
          resolvedAt: row.resolvedAt,
        },
      ]
    })

    return [...mathItems, ...calcItems, ...englishItems].sort(
      (a, b) => new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime(),
    )
  }, [mathRows, calcMistakes, englishRows, vocab])

  const refetch = () => {
    void refetchWrong()
    void refreshCalc()
    void refetchEnglish()
  }

  return {
    items,
    isLoading: calcLoading,
    refetch,
    counts: {
      unresolved: items.filter((i) => i.status === 'unresolved').length,
      resolved: items.filter((i) => i.status === 'resolved').length,
      total: items.length,
      math: items.filter((i) => i.module === 'math').length,
      calc: items.filter((i) => i.module === 'calc').length,
      english: items.filter((i) => i.module === 'english').length,
    },
  }
}

export function filterMistakes(
  items: UnifiedMistakeItem[],
  status: MistakeStatusFilter,
  module: MistakeModuleFilter,
): UnifiedMistakeItem[] {
  return items.filter((item) => {
    if (status === 'unresolved' && item.status !== 'unresolved') return false
    if (status === 'resolved' && item.status !== 'resolved') return false
    if (module !== 'all' && item.module !== module) return false
    return true
  })
}
