'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { STORAGE_KEYS } from '@/utils/constant'
import { SAMPLE_WORDS } from '@/utils/english-data'

function loadLocal(): WordEntry[] {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.WORD_DATA)
    return item ? JSON.parse(item) : SAMPLE_WORDS
  } catch {
    return SAMPLE_WORDS
  }
}

function saveLocal(data: WordEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.WORD_DATA, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>(SAMPLE_WORDS)

  // Load on mount or user change
  useEffect(() => {
    if (!user) {
      setVocabState(loadLocal())
      return
    }
    // Load from Supabase
    supabase
      .from('word_entries')
      .select('unit, lesson, word, explanation, ipa, example, phonics')
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const words: WordEntry[] = data.map(row => ({
            unit: row.unit,
            lesson: row.lesson,
            word: row.word,
            explanation: row.explanation,
            ipa: row.ipa ?? undefined,
            example: row.example ?? undefined,
            phonics: row.phonics ?? undefined,
          }))
          setVocabState(words)
          saveLocal(words)
        } else {
          // No cloud data yet, use local
          setVocabState(loadLocal())
        }
      })
  }, [user])

  const setVocab = useCallback(async (words: WordEntry[]) => {
    setVocabState(words)
    saveLocal(words)

    if (!user) return

    // Replace all word entries for this user
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
