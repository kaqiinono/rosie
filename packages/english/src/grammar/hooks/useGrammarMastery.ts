'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { GrammarBookId, GrammarMasteryMap } from '../types'

interface GrammarMasteryRow {
  book: string
  unit_number: number
  correct_count: number | null
  total_count: number | null
  mastered: boolean | null
  last_practiced_at: string | null
}

const DEFAULT_BOOK: GrammarBookId = 'essential'

async function fetchGrammarMastery(userId: string): Promise<GrammarMasteryMap> {
  const { data } = await supabase
    .from('grammar_mastery')
    .select('book,unit_number,correct_count,total_count,mastered,last_practiced_at')
    .eq('user_id', userId)
    .eq('book', DEFAULT_BOOK)
  const map: GrammarMasteryMap = {}
  for (const row of (data ?? []) as GrammarMasteryRow[]) {
    map[`${row.book}:${row.unit_number}`] = {
      correct: row.correct_count ?? 0,
      total: row.total_count ?? 0,
      mastered: row.mastered ?? false,
      lastPracticedAt: row.last_practiced_at ?? '',
    }
  }
  return map
}

export const grammarMasteryStore = createUserSessionStore<GrammarMasteryMap>('grammar_mastery', {
  fetch: fetchGrammarMastery,
  empty: {},
})

export function useGrammarMastery(user: User | null) {
  const { data: masteryMap, isLoading } = grammarMasteryStore.useSessionData(user)

  /** 单元练习完成后上报：全部可判分题答对 → mastered */
  const recordPractice = useCallback(
    async (unitNumber: number, correct: number, total: number, book: GrammarBookId = DEFAULT_BOOK) => {
      if (!user || total === 0) return
      const mastered = correct === total
      const now = new Date().toISOString()
      grammarMasteryStore.patchSessionData(user.id, (prev) => ({
        ...prev,
        [`${book}:${unitNumber}`]: { correct, total, mastered, lastPracticedAt: now },
      }))
      await supabase.from('grammar_mastery').upsert(
        {
          user_id: user.id,
          book,
          unit_number: unitNumber,
          correct_count: correct,
          total_count: total,
          mastered,
          last_practiced_at: now,
        },
        { onConflict: 'user_id,book,unit_number' },
      )
    },
    [user],
  )

  return { masteryMap, recordPractice, isLoading }
}
