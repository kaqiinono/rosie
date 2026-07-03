'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { allMathProblemStats } from '@rosie/math/utils/grade-stats'
import { G1B_RECOGNIZE_TOTAL } from '@rosie/chinese'

export type HomeStats = {
  mathPracticed: number
  mathTotal: number
  englishPracticed: number
  englishTotal: number
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
  englishTotal: 0,
  chineseRecognized: 0,
  chineseRecognizeTotal: 0,
  calcTotal: 0,
  calcPracticeDays: 0,
  mistakesUnresolved: 0,
}

function countUnresolved(rows: { resolved?: boolean | null }[] | null): number {
  return (rows ?? []).filter(r => !(r.resolved ?? false)).length
}

type StatsCache = { userId: string; stats: HomeStats }

export function useHomeStats(user: User | null) {
  const userId = user?.id ?? null
  const [cache, setCache] = useState<StatsCache | null>(null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    const load = async () => {
      const [
        { data: mathRows },
        { data: masteryRows },
        { count: vocabTotal },
        { data: chineseMasteryRows },
        { count: chineseRecognizeTotal },
        { data: calcRows },
        { data: mathWrongRows },
        { data: calcWrongRows },
        { data: englishWrongRows },
      ] = await Promise.all([
        supabase.from('math_solved').select('problem_id, solve_count').eq('user_id', userId),
        supabase.from('word_mastery').select('correct, incorrect, last_seen').eq('user_id', userId),
        supabase.from('word_entries').select('id', { count: 'exact', head: true }),
        supabase
          .from('chinese_char_mastery')
          .select('correct, incorrect, last_seen')
          .eq('user_id', userId)
          .eq('track', 'recognize'),
        supabase
          .from('chinese_char_entries')
          .select('char_key', { count: 'exact', head: true })
          .contains('tiers', ['recognize']),
        supabase.from('calc_sessions').select('date, correct_count, retry_count, wrong_count').eq('user_id', userId),
        supabase.from('math_wrong').select('resolved').eq('user_id', userId),
        supabase.from('calc_mistakes').select('resolved').eq('user_id', userId),
        supabase.from('english_wrong').select('resolved').eq('user_id', userId),
      ])
      if (cancelled) return

      const solveCount: Record<string, number> = {}
      for (const row of mathRows ?? []) {
        solveCount[row.problem_id] = row.solve_count ?? 1
      }
      const { practiced: mathPracticed, total: mathTotal } = allMathProblemStats(solveCount)

      let englishPracticed = 0
      for (const row of masteryRows ?? []) {
        const attempts = (row.correct ?? 0) + (row.incorrect ?? 0)
        if (attempts > 0 || row.last_seen) englishPracticed++
      }

      let chineseRecognized = 0
      for (const row of chineseMasteryRows ?? []) {
        const attempts = (row.correct ?? 0) + (row.incorrect ?? 0)
        if (attempts > 0 || row.last_seen) chineseRecognized++
      }

      const calcDays = new Set<string>()
      let calcTotal = 0
      for (const row of calcRows ?? []) {
        calcDays.add(row.date)
        calcTotal += (row.correct_count ?? 0) + (row.retry_count ?? 0) + (row.wrong_count ?? 0)
      }

      setCache({
        userId,
        stats: {
          mathPracticed,
          mathTotal,
          englishPracticed,
          englishTotal: vocabTotal ?? 0,
          chineseRecognized,
          chineseRecognizeTotal:
            chineseRecognizeTotal && chineseRecognizeTotal > 0
              ? chineseRecognizeTotal
              : G1B_RECOGNIZE_TOTAL,
          calcTotal,
          calcPracticeDays: calcDays.size,
          mistakesUnresolved:
            countUnresolved(mathWrongRows) +
            countUnresolved(calcWrongRows) +
            countUnresolved(englishWrongRows),
        },
      })
    }
    void load()
    return () => { cancelled = true }
  }, [userId])

  const stats = userId && cache?.userId === userId ? cache.stats : EMPTY_STATS
  const isLoading = userId !== null && cache?.userId !== userId

  return { stats, isLoading }
}
