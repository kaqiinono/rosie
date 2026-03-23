'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getMasteryLevel, advanceStage, regressStage } from '@/utils/masteryUtils'
import { wordKey } from '@/utils/english-helpers'
import type { WordEntry, WordMasteryMap, WordMasteryInfo } from '@/utils/type'

export function useWordMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<WordMasteryMap>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('word_mastery')
        .select('word_key, correct, incorrect, last_seen, stage, next_review_date, is_hard')
        .eq('user_id', user.id)
      if (!data) return
      const record: WordMasteryMap = {}
      data.forEach(row => {
        record[row.word_key] = {
          correct: row.correct ?? 0,
          incorrect: row.incorrect ?? 0,
          lastSeen: row.last_seen ?? '',
          stage: row.stage ?? undefined,
          nextReviewDate: row.next_review_date ?? undefined,
          isHard: row.is_hard ?? undefined,
        }
      })
      setMasteryMap(record)
    })()
  }, [user])

  const recordBatch = useCallback((results: { entry: WordEntry; correct: boolean }[]) => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    setMasteryMap(prev => {
      const next = { ...prev }
      for (const { entry, correct: isCorrect } of results) {
        const key = wordKey(entry)
        const cur = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const updated = isCorrect ? advanceStage(cur, today) : regressStage(cur, today)
        next[key] = {
          ...updated,
          correct: isCorrect ? cur.correct + 1 : cur.correct,
          incorrect: isCorrect ? cur.incorrect : cur.incorrect + 1,
          lastSeen: today,
        }
      }

      const rows = results.map(({ entry, correct: isCorrect }) => {
        const key = wordKey(entry)
        const updated = next[key]
        return {
          user_id: user.id,
          word_key: key,
          correct: updated.correct,
          incorrect: updated.incorrect,
          last_seen: today,
          stage: updated.stage,
          next_review_date: updated.nextReviewDate ?? null,
          is_hard: updated.isHard ?? false,
          updated_at: new Date().toISOString(),
        }
      })
      supabase.from('word_mastery').upsert(rows, { onConflict: 'user_id,word_key' })
        .then(({ error }) => { if (error) console.error('[word_mastery] upsert failed', error) })

      return next
    })
  }, [user])

  const getMastery = useCallback((entry: WordEntry): WordMasteryInfo => {
    return masteryMap[wordKey(entry)] ?? { correct: 0, incorrect: 0, lastSeen: '' }
  }, [masteryMap])

  const isMastered = useCallback((entry: WordEntry): boolean => {
    return getMasteryLevel(getMastery(entry).correct) === 3
  }, [getMastery])

  return { masteryMap, recordBatch, getMastery, isMastered }
}
