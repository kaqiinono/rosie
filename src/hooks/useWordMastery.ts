'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'
import { getMasteryLevel } from '@/utils/masteryUtils'
import { wordKey } from '@/utils/english-helpers'
import type { WordEntry, WordMasteryMap, WordMasteryInfo } from '@/utils/type'

function loadLocal(): WordMasteryMap {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.WORD_MASTERY)
    if (!item) return {}
    return JSON.parse(item) as WordMasteryMap
  } catch {
    return {}
  }
}

function saveLocal(data: WordMasteryMap) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.WORD_MASTERY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function useWordMastery(user: User | null) {
  const [masteryMap, setMasteryMap] = useState<WordMasteryMap>({})

  useEffect(() => {
    if (!user) {
      setMasteryMap(loadLocal())
      return
    }
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('word_mastery')
          .select('word_key, correct, incorrect, last_seen')
          .eq('user_id', user.id)
        if (error || !data) {
          setMasteryMap(loadLocal())
          return
        }
        const record: WordMasteryMap = {}
        data.forEach(row => {
          record[row.word_key] = {
            correct: row.correct ?? 0,
            incorrect: row.incorrect ?? 0,
            lastSeen: row.last_seen ?? '',
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

  const recordBatch = useCallback((results: { entry: WordEntry; correct: boolean }[]) => {
    const today = new Date().toISOString().slice(0, 10)
    setMasteryMap(prev => {
      const next = { ...prev }
      for (const { entry, correct } of results) {
        const key = wordKey(entry)
        const cur = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        next[key] = {
          correct: correct ? cur.correct + 1 : cur.correct,
          incorrect: correct ? cur.incorrect : cur.incorrect + 1,
          lastSeen: today,
        }
      }
      saveLocal(next)

      if (user) {
        const rows = results.map(({ entry, correct: isCorrect }) => {
          const key = wordKey(entry)
          const updated = next[key]
          return {
            user_id: user.id,
            word_key: key,
            correct: updated.correct,
            incorrect: updated.incorrect,
            last_seen: today,
            updated_at: new Date().toISOString(),
          }
        })
        void supabase
          .from('word_mastery')
          .upsert(rows, { onConflict: 'user_id,word_key' })
      }

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
