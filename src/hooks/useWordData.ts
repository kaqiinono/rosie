'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WordEntry } from '@/utils/type'
import { SAMPLE_WORDS } from '@/utils/english-data'

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
  }
}

export function useWordData(user: User | null) {
  const [vocab, setVocabState] = useState<WordEntry[]>([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('word_entries')
      .select('stage, unit, lesson, word, explanation, ipa, example, phonics')
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          setVocabState(data.map(row => ({
            stage: row.stage ?? undefined,
            unit: row.unit,
            lesson: row.lesson,
            word: row.word,
            explanation: row.explanation,
            ipa: row.ipa ?? undefined,
            example: row.example ?? undefined,
            phonics: row.phonics ?? undefined,
          })))
        } else {
          // 首次使用：将 SAMPLE_WORDS 写入数据库
          await supabase.from('word_entries').insert(
            SAMPLE_WORDS.map(w => toRow(user.id, w))
          )
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

  // 按 stage 追加：删除相同 stage 的旧数据，插入新数据，其他 stage 不受影响
  const upsertByStage = useCallback(async (words: WordEntry[]) => {
    if (!user || !words.length) return
    const stages = [...new Set(words.map(w => w.stage).filter(Boolean))]
    for (const stage of stages) {
      await supabase.from('word_entries').delete().eq('user_id', user.id).eq('stage', stage)
    }
    await supabase.from('word_entries').insert(words.map(w => toRow(user.id, w)))
    // 重新从数据库拉取保持一致
    const { data } = await supabase
      .from('word_entries')
      .select('stage, unit, lesson, word, explanation, ipa, example, phonics')
      .eq('user_id', user.id)
      .order('unit')
      .order('lesson')
    if (data) {
      setVocabState(data.map(row => ({
        stage: row.stage ?? undefined,
        unit: row.unit,
        lesson: row.lesson,
        word: row.word,
        explanation: row.explanation,
        ipa: row.ipa ?? undefined,
        example: row.example ?? undefined,
        phonics: row.phonics ?? undefined,
      })))
    }
  }, [user])

  return { vocab, setVocab, upsertByStage }
}
