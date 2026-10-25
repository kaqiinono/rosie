'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { READING_AUDIO_BUCKET, readingPassageAudioPath, baiduReadingAudioUrl } from '../utils/reading-audio-types'
import { useBaiduReadingAudio } from './useBaiduReadingAudio'

/**
 * Detail-page hook: prefer discovered Baidu narration, otherwise emit Storage synchronously,
 * with an asynchronous `?v=<updatedAt>` cache-buster appended once the DB
 * lookup completes. Never lists the storage bucket, never scans all passages.
 */
export function useReadingPassageAudio(user: User | null, passageKey: string) {
  const baidu = useBaiduReadingAudio(user)
  const [revision, setRevision] = useState<{ key: string; updatedAt: string } | null>(null)
  const updatedAt = revision?.key === passageKey ? revision.updatedAt : null

  const baseUrl = useMemo(() => {
    const path = readingPassageAudioPath(passageKey)
    const { data } = supabase.storage.from(READING_AUDIO_BUCKET).getPublicUrl(path)
    return data.publicUrl ?? null
  }, [passageKey])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('reading_passage_media')
        .select('updated_at')
        .eq('passage_key', passageKey)
        .maybeSingle()
      if (cancelled) return
      const ts = (data as { updated_at?: string } | null)?.updated_at
      if (ts) setRevision({ key: passageKey, updatedAt: ts })
    })()
    return () => {
      cancelled = true
    }
  }, [user, passageKey])

  return useMemo(() => {
    if (baidu.hasAudio(passageKey)) return baiduReadingAudioUrl(passageKey)
    if (!baseUrl) return null
    return updatedAt ? `${baseUrl}?v=${encodeURIComponent(updatedAt)}` : baseUrl
  }, [baidu.hasAudio, passageKey, baseUrl, updatedAt])
}
