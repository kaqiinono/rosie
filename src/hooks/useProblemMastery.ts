'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { advanceStage, regressStage } from '@/utils/masteryUtils'
import type { ProblemMasteryMap, WordMasteryInfo } from '@/utils/type'

function loadLocal(): ProblemMasteryMap {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.PROBLEM_MASTERY)
    if (!item) return {}
    return JSON.parse(item) as ProblemMasteryMap
  } catch {
    return {}
  }
}

function saveLocal(data: ProblemMasteryMap) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.PROBLEM_MASTERY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function useProblemMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<ProblemMasteryMap>({})

  useEffect(() => {
    if (!user) {
      setMasteryMap(loadLocal())
      return
    }
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('problem_mastery')
          .select('problem_key, correct, incorrect, last_seen, stage, next_review_date, is_hard')
          .eq('user_id', user.id)
        if (error || !data) {
          setMasteryMap(loadLocal())
          return
        }
        const record: ProblemMasteryMap = {}
        data.forEach(row => {
          record[row.problem_key] = {
            correct: row.correct ?? 0,
            incorrect: row.incorrect ?? 0,
            lastSeen: row.last_seen ?? '',
            stage: row.stage ?? undefined,
            nextReviewDate: row.next_review_date ?? undefined,
            isHard: row.is_hard ?? undefined,
          }
        })
        setMasteryMap(record)
        saveLocal(record)
      } catch {
        setMasteryMap(loadLocal())
      }
    }
    void load()
  }, [user])

  const masteryMapRef = useRef(masteryMap)
  useEffect(() => { masteryMapRef.current = masteryMap }, [masteryMap])

  const recordProblemResult = useCallback((key: string, correct: boolean) => {
    const today = new Date().toISOString().slice(0, 10)
    const cur: WordMasteryInfo = masteryMapRef.current[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    const updated = correct ? advanceStage(cur, today) : regressStage(cur, today)
    const info: WordMasteryInfo = {
      ...updated,
      correct: correct ? cur.correct + 1 : cur.correct,
      incorrect: correct ? cur.incorrect : cur.incorrect + 1,
      lastSeen: today,
    }

    setMasteryMap(prev => {
      const next: ProblemMasteryMap = { ...prev, [key]: info }
      saveLocal(next)
      return next
    })

    if (user) {
      supabase
        .from('problem_mastery')
        .upsert(
          {
            user_id: user.id,
            problem_key: key,
            correct: info.correct,
            incorrect: info.incorrect,
            last_seen: today,
            stage: info.stage,
            next_review_date: info.nextReviewDate ?? null,
            is_hard: info.isHard ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,problem_key' },
        )
        .then(({ error }) => {
          if (error) console.error('[problem_mastery] upsert error:', error)
        })
    }
  }, [user])

  return { masteryMap, recordProblemResult }
}
