'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { ChineseCharProfile, ChineseLessonRow } from '../types/chineseCharData'
import type { CharTier } from '../utils/g1b/types'

export interface CharEntryPatch {
  pinyin?: string
  pinyinAlt?: string[]
  radical?: string
  radicalName?: string
  structure?: string
  phrases?: string[]
  tiers?: CharTier[]
}

export interface LessonPatch {
  lessonTitle?: string
  recallPhrases?: string[]
}

function charRowFromPatch(patch: CharEntryPatch) {
  return {
    ...(patch.pinyin !== undefined ? { pinyin: patch.pinyin } : {}),
    ...(patch.pinyinAlt !== undefined ? { pinyin_alt: patch.pinyinAlt } : {}),
    ...(patch.radical !== undefined ? { radical: patch.radical } : {}),
    ...(patch.radicalName !== undefined ? { radical_name: patch.radicalName } : {}),
    ...(patch.structure !== undefined ? { structure: patch.structure } : {}),
    ...(patch.phrases !== undefined ? { phrases: patch.phrases } : {}),
    ...(patch.tiers !== undefined ? { tiers: patch.tiers } : {}),
    updated_at: new Date().toISOString(),
  }
}

export function useChineseCharAdmin(user: User | null, refresh: () => Promise<void>) {
  const updateCharEntry = useCallback(
    async (charKeyValue: string, patch: CharEntryPatch) => {
      if (!user) return
      const { error } = await supabase
        .from('chinese_char_entries')
        .update(charRowFromPatch(patch))
        .eq('char_key', charKeyValue)
      if (error) throw error
      await refresh()
    },
    [user, refresh],
  )

  const updateLesson = useCallback(
    async (lessonKey: string, patch: LessonPatch) => {
      if (!user) return
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.lessonTitle !== undefined) row.lesson_title = patch.lessonTitle
      if (patch.recallPhrases !== undefined) row.recall_phrases = patch.recallPhrases
      const { error } = await supabase.from('chinese_lessons').update(row).eq('lesson_key', lessonKey)
      if (error) throw error
      await refresh()
    },
    [user, refresh],
  )

  const updateLessonCharPinyin = useCallback(
    async (lessonKey: string, charKeyValue: string, track: CharTier, pinyinInLesson: string) => {
      if (!user) return
      const { error } = await supabase
        .from('chinese_lesson_chars')
        .update({ pinyin_in_lesson: pinyinInLesson })
        .eq('lesson_key', lessonKey)
        .eq('char_key', charKeyValue)
        .eq('track', track)
      if (error) throw error
      await refresh()
    },
    [user, refresh],
  )

  return { updateCharEntry, updateLesson, updateLessonCharPinyin }
}

export type { ChineseCharProfile, ChineseLessonRow }
