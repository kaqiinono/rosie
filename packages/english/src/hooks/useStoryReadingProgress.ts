'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export interface StoryReadingProgress {
  volumeKey: string
  chapterKey: string
  startSentenceIndex: number
  startSentenceText: string
  endSentenceIndex: number
  endSentenceText: string
  viewMode: 'chapter' | 'volume'
  updatedAt: string
}

interface RawProgressRow {
  volume_key: string
  chapter_key: string
  start_sentence_index: number
  start_sentence_text: string
  end_sentence_index: number
  end_sentence_text: string
  view_mode: 'chapter' | 'volume'
  updated_at: string
}

function mapProgress(row: RawProgressRow): StoryReadingProgress {
  return {
    volumeKey: row.volume_key,
    chapterKey: row.chapter_key,
    startSentenceIndex: row.start_sentence_index,
    startSentenceText: row.start_sentence_text,
    endSentenceIndex: row.end_sentence_index,
    endSentenceText: row.end_sentence_text,
    viewMode: row.view_mode,
    updatedAt: row.updated_at,
  }
}

export function useStoryReadingProgress(user: User | null, volumeKey: string) {
  const [progress, setProgress] = useState<StoryReadingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(user))

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void supabase
      .from('story_reading_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('volume_key', volumeKey)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProgress(data ? mapProgress(data as RawProgressRow) : null)
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, volumeKey])

  const saveProgress = useCallback(
    async (input: Omit<StoryReadingProgress, 'volumeKey' | 'updatedAt'>) => {
      if (!user) return { error: '请先登录' }
      const updatedAt = new Date().toISOString()
      const next: StoryReadingProgress = { ...input, volumeKey, updatedAt }
      const { error } = await supabase.from('story_reading_progress').upsert(
        {
          user_id: user.id,
          volume_key: volumeKey,
          chapter_key: input.chapterKey,
          start_sentence_index: input.startSentenceIndex,
          start_sentence_text: input.startSentenceText,
          end_sentence_index: input.endSentenceIndex,
          end_sentence_text: input.endSentenceText,
          view_mode: input.viewMode,
          updated_at: updatedAt,
        },
        { onConflict: 'user_id,volume_key' },
      )
      if (!error) setProgress(next)
      return { error: error?.message ?? null }
    },
    [user, volumeKey],
  )

  const clearProgress = useCallback(async () => {
    if (!user) return
    const { error } = await supabase
      .from('story_reading_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('volume_key', volumeKey)
    if (!error) setProgress(null)
  }, [user, volumeKey])

  return {
    progress: user ? progress : null,
    isLoading: Boolean(user) && isLoading,
    saveProgress,
    clearProgress,
  }
}
