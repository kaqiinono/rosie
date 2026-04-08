'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { SAMPLE_WORDS } from '@/utils/english-data'

const SELECT_COLS = 'stage, unit, lesson, word, explanation, ipa, example, phonics, syllables, keywords'

function toRow(user_id: string, w: WordEntry) {
  return {
    user_id,
    stage: w.stage ?? null,
    unit: w.unit,
    lesson: w.lesson,
    word: w.word,
    explanation: w.explanation,
    ipa: w.ipa ?? null,
    example: w.example ?? null,
    phonics: w.phonics ?? null,
    syllables: w.syllables ?? null,
    keywords: w.keywords ?? null,
  }
}

function fromRow(row: Record<string, unknown>): WordEntry {
  return {
    stage: (row.stage as string) ?? undefined,
    unit: row.unit as string,
    lesson: row.lesson as string,
    word: row.word as string,
    explanation: row.explanation as string,
    ipa: (row.ipa as string) ?? undefined,
    example: (row.example as string) ?? undefined,
    phonics: (row.phonics as string) ?? undefined,
    syllables: (row.syllables as string[]) ?? undefined,
    keywords: (row.keywords as [string, string][]) ?? undefined,
  }
}

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('word_entries')
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          setVocabState(data.map(fromRow))
        } else {
          // 首次使用：将 SAMPLE_WORDS（含 syllables/keywords）写入数据库
          await supabase.from('word_entries').insert(SAMPLE_WORDS.map(w => toRow(user.id, w)))
          setVocabState(SAMPLE_WORDS)
        }
      })
  }, [user])

  const setVocab = useCallback(async (words: WordEntry[]) => {
    setVocabState(words)
    if (!user) return
    await supabase.from('word_entries').delete().eq('user_id', user.id)
    if (words.length > 0) {
      await supabase.from('word_entries').insert(words.map(w => toRow(user.id, w)))
    }
  }, [user])

  const upsertByStage = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    const stages = [...new Set(words.map(w => w.stage).filter(Boolean))]
    for (const stage of stages) {
      await supabase.from('word_entries').delete().eq('user_id', user.id).eq('stage', stage)
    }
    await supabase.from('word_entries').insert(words.map(w => toRow(user.id, w)))
    const { data } = await supabase
      .from('word_entries')
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
    if (data) setVocabState(data.map(fromRow))
  }, [user])

  return { vocab, setVocab, upsertByStage }
}
