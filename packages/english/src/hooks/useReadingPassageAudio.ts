'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { READING_AUDIO_BUCKET, readingPassageAudioPath } from '../utils/reading-audio-types'

/**
 * Detail-page hook: emit the audio URL for a single passage synchronously,
 * with an asynchronous `?v=<updatedAt>` cache-buster appended once the DB
 * lookup completes. Never lists the storage bucket, never scans all passages.
 */
export function useReadingPassageAudio(user: User | null, passageKey: string) {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

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
      if (ts) setUpdatedAt(ts)
    })()
    return () => {
      cancelled = true
    }
  }, [user, passageKey])

  return useMemo(() => {
    if (!baseUrl) return null
    return updatedAt ? `${baseUrl}?v=${encodeURIComponent(updatedAt)}` : baseUrl
  }, [baseUrl, updatedAt])
}
