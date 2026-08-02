'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { allMathProblemStats } from '@rosie/math/utils/grade-stats'
import { G1B_RECOGNIZE_TOTAL } from '@rosie/chinese'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { useWordMastery } from '@rosie/english'
import { useEnglishWrong } from '@rosie/english'
import { useCharMastery } from '@rosie/chinese'
import { useCalcMistakes } from '@rosie/calc'
import { useCalcPracticeStats } from '@rosie/calc'

export type HomeStats = {
  mathPracticed: number
  mathTotal: number
  englishPracticed: number
  chineseRecognized: number
  chineseRecognizeTotal: number
  calcTotal: number
  calcPracticeDays: number
  mistakesUnresolved: number
}

const EMPTY_STATS: HomeStats = {
  mathPracticed: 0,
  mathTotal: 0,
  englishPracticed: 0,
  chineseRecognized: 0,
  chineseRecognizeTotal: 0,
  calcTotal: 0,
  calcPracticeDays: 0,
  mistakesUnresolved: 0,
}

function countUnresolved(rows: { resolved?: boolean | null }[]): number {
  return rows.filter((r) => !(r.resolved ?? false)).length
}

/**
 * Homepage learning-overview stats.
 * Pass `user` only after the overview panel is near the viewport so cold
 * loads skip math_solved / word_mastery / wrong-book fetches.
 */
export function useHomeStats(user: User | null) {
  const { solveCount, isLoading: mathLoading } = useMathSolved(user)
  const { masteryMap, isLoading: wmLoading } = useWordMastery(user)
  const { masteryMap: chineseMastery, isLoading: cmLoading } = useCharMastery(user)
  const { totalProblems, practiceDays, isLoading: calcLoading } = useCalcPracticeStats(user)

  const [mistakesEnabled, setMistakesEnabled] = useState(false)

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMistakesEnabled(false)
      return
    }
    let cancelled = false
    const run = () => {
      if (!cancelled) setMistakesEnabled(true)
    }
    // Wrong-book trio is lower priority than practiced/total counts.
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }
    const t = setTimeout(run, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [user])

  const mistakeUser = mistakesEnabled ? user : null
  const { rows: mathWrong, isLoading: mwLoading } = useMathWrong(mistakeUser)
  const { mistakes: calcMistakes, isLoading: cmistLoading } = useCalcMistakes(mistakeUser, {
    loadProblemState: false,
  })
  const { rows: englishWrong, isLoading: ewLoading } = useEnglishWrong(mistakeUser)

  const isLoading =
    user !== null &&
    (mathLoading || wmLoading || cmLoading || calcLoading)

  const stats = useMemo((): HomeStats => {
    if (!user) return EMPTY_STATS

    const { practiced: mathPracticed, total: mathTotal } = allMathProblemStats(solveCount)

    let englishPracticed = 0
    for (const row of Object.values(masteryMap)) {
      const attempts = (row.correct ?? 0) + (row.incorrect ?? 0)
      if (attempts > 0 || row.lastSeen) englishPracticed++
    }

    let chineseRecognized = 0
    for (const [key, row] of Object.entries(chineseMastery)) {
      if (!key.endsWith('::recognize')) continue
      const attempts = (row.correct ?? 0) + (row.incorrect ?? 0)
      if (attempts > 0 || row.lastSeen) chineseRecognized++
    }

    return {
      mathPracticed,
      mathTotal,
      englishPracticed,
      chineseRecognized,
      chineseRecognizeTotal: G1B_RECOGNIZE_TOTAL,
      calcTotal: totalProblems,
      calcPracticeDays: practiceDays,
      mistakesUnresolved:
        !mistakesEnabled || mwLoading || cmistLoading || ewLoading
          ? 0
          : countUnresolved(mathWrong) +
            countUnresolved(calcMistakes) +
            countUnresolved(englishWrong),
    }
  }, [
    user,
    solveCount,
    masteryMap,
    chineseMastery,
    totalProblems,
    practiceDays,
    mistakesEnabled,
    mwLoading,
    cmistLoading,
    ewLoading,
    mathWrong,
    calcMistakes,
    englishWrong,
  ])

  return { stats, isLoading }
}
