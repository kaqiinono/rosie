'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getWordMasteryLevel, advanceStage, regressStage } from '@/utils/masteryUtils'
import { wordKey } from '@/utils/english-helpers'
import type { WordEntry, WordMasteryMap, WordMasteryInfo, ReviewRecord } from '@/utils/type'

export function useWordMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<WordMasteryMap>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('word_mastery')
        .select('word_key, correct, incorrect, last_seen, stage, next_review_date, is_hard, review_history')
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
          reviewHistory: (row.review_history as ReviewRecord[] | null) ?? [],
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

      // Aggregate per word: collect corrects/total across all question types
      const byKey = new Map<string, { entry: WordEntry; corrects: number; total: number }>()
      for (const { entry, correct: isCorrect } of results) {
        const key = wordKey(entry)
        const g = byKey.get(key) ?? { entry, corrects: 0, total: 0 }
        g.corrects += isCorrect ? 1 : 0
        g.total += 1
        byKey.set(key, g)
      }

      // One stage change per word per session; same-day sessions don't re-advance
      for (const [key, g] of byKey) {
        const cur = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const allCorrect = g.corrects === g.total
        const majorityCorrect = g.corrects > g.total / 2
        const alreadySeenToday = cur.lastSeen === today

        let updated: WordMasteryInfo
        if (allCorrect && !alreadySeenToday) {
          updated = advanceStage(cur, today, key)
        } else if (!majorityCorrect && !alreadySeenToday) {
          updated = regressStage(cur, today)
        } else {
          updated = cur
        }

        // Always accumulate answer counts and history regardless of stage change
        const perItemHistory = results
          .filter(r => wordKey(r.entry) === key)
          .map(r => ({ date: today, correct: r.correct }))

        next[key] = {
          ...updated,
          correct: cur.correct + g.corrects,
          incorrect: cur.incorrect + (g.total - g.corrects),
          lastSeen: today,
          reviewHistory: [...(cur.reviewHistory ?? []), ...perItemHistory],
        }
      }

      const rows = [...byKey.keys()].map(key => {
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
          review_history: updated.reviewHistory ?? [],
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
    return getWordMasteryLevel(getMastery(entry).correct) === 3
  }, [getMastery])

  return { masteryMap, recordBatch, getMastery, isMastered }
}
