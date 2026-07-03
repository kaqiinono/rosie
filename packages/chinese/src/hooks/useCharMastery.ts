'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { advanceStage, regressStage } from '@rosie/core'
import { masteryKey } from '../utils/chinese-helpers'
import type { CharTrack } from '../utils/chinese-helpers'
import type { WordMasteryInfo, ReviewRecord } from '@rosie/core'

export type CharMasteryMap = Record<string, WordMasteryInfo>

export interface CharMasteryResult {
  charKey: string
  track: CharTrack
  correct: boolean
}

export function useCharMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<CharMasteryMap>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('chinese_char_mastery')
        .select('char_key, track, correct, incorrect, last_seen, stage, next_review_date, is_hard, review_history')
        .eq('user_id', user.id)
      if (!data) return
      const record: CharMasteryMap = {}
      data.forEach((row) => {
        const key = masteryKey(row.char_key, row.track as CharTrack)
        record[key] = {
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

  const recordBatch = useCallback((results: CharMasteryResult[]) => {
    if (!user) return
    if (results.length === 0) return
    const today = new Date().toISOString().slice(0, 10)

    type Group = { charKey: string; track: CharTrack; corrects: number; total: number }
    const byKey = new Map<string, Group>()
    for (const { charKey, track, correct } of results) {
      const k = masteryKey(charKey, track)
      const g = byKey.get(k) ?? { charKey, track, corrects: 0, total: 0 }
      if (correct) g.corrects += 1
      g.total += 1
      byKey.set(k, g)
    }

    setMasteryMap((prev) => {
      const next = { ...prev }
      const touched: { charKey: string; track: CharTrack }[] = []

      for (const [key, g] of byKey) {
        const cur: WordMasteryInfo = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const allCorrect = g.corrects === g.total
        const majorityCorrect = g.corrects > g.total / 2
        const sameDay = cur.lastSeen === today

        let stageUpdated: WordMasteryInfo
        if (allCorrect && !sameDay) {
          stageUpdated = advanceStage(cur, today, key)
        } else if (!majorityCorrect && !sameDay) {
          stageUpdated = regressStage(cur, today)
        } else {
          stageUpdated = cur
        }

        const historyAppends = results
          .filter((r) => masteryKey(r.charKey, r.track) === key)
          .map((r) => ({ date: today, correct: r.correct }))

        next[key] = {
          ...stageUpdated,
          correct: cur.correct + g.corrects,
          incorrect: cur.incorrect + (g.total - g.corrects),
          lastSeen: today,
          reviewHistory: [...(cur.reviewHistory ?? []), ...historyAppends],
        }
        touched.push({ charKey: g.charKey, track: g.track })
      }

      const rows = touched.map(({ charKey, track }) => {
        const mapKey = masteryKey(charKey, track)
        const updated = next[mapKey]
        return {
          user_id: user.id,
          char_key: charKey,
          track,
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
      supabase
        .from('chinese_char_mastery')
        .upsert(rows, { onConflict: 'user_id,char_key,track' })
        .then(({ error }) => {
          if (error) console.error('[chinese_char_mastery] upsert failed', error)
        })

      return next
    })
  }, [user])

  const getMastery = useCallback(
    (charKeyValue: string, track: CharTrack): WordMasteryInfo => {
      return masteryMap[masteryKey(charKeyValue, track)] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    },
    [masteryMap],
  )

  return { masteryMap, recordBatch, getMastery }
}
