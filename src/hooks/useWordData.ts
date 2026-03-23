'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { SAMPLE_WORDS } from '@/utils/english-data'

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>(SAMPLE_WORDS)

  useEffect(() => {
    if (!user) return
    supabase
      .from('word_entries')
      .select('unit, lesson, word, explanation, ipa, example, phonics')
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setVocabState(data.map(row => ({
            unit: row.unit,
            lesson: row.lesson,
            word: row.word,
            explanation: row.explanation,
            ipa: row.ipa ?? undefined,
            example: row.example ?? undefined,
            phonics: row.phonics ?? undefined,
          })))
        } else {
          setVocabState(SAMPLE_WORDS)
        }
      })
  }, [user])

  const setVocab = useCallback(async (words: WordEntry[]) => {
    setVocabState(words)
    if (!user) return
    await supabase.from('word_entries').delete().eq('user_id', user.id)
    if (words.length > 0) {
      await supabase.from('word_entries').insert(
        words.map(w => ({
          user_id: user.id,
          unit: w.unit,
          lesson: w.lesson,
          word: w.word,
          explanation: w.explanation,
          ipa: w.ipa ?? null,
          example: w.example ?? null,
          phonics: w.phonics ?? null,
        }))
      )
    }
  }, [user])

  return { vocab, setVocab }
}
