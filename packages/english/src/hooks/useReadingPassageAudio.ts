'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import {
  READING_AUDIO_BUCKET,
  readingPassageAudioPath,
  baiduReadingAudioUrl,
  lessonAudioUrl,
} from '../utils/reading-audio-types'
import { useBaiduReadingAudio } from './useBaiduReadingAudio'

/** Prefer explicit Netdisk bindings, then legacy discovered files and unmigrated Storage narration. */
export function useReadingPassageAudio(user: User | null, passageKey: string) {
  const { hasAudio, isLoading } = useBaiduReadingAudio(user)
  const bound = hasAudio(passageKey + '#narration')
  const [revision, setRevision] = useState<{ key: string; updatedAt: string } | null>(null)
  const updatedAt = revision?.key === passageKey ? revision.updatedAt : null

  const baseUrl = useMemo(() => {
    if (bound || isLoading) return null
    const path = readingPassageAudioPath(passageKey)
    const { data } = supabase.storage.from(READING_AUDIO_BUCKET).getPublicUrl(path)
    return data.publicUrl ?? null
  }, [passageKey, bound, isLoading])

  useEffect(() => {
    if (!user || bound || isLoading || !passageKey) return
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
  }, [user, passageKey, bound, isLoading])

  return useMemo(() => {
    if (isLoading) return null
    if (bound) return lessonAudioUrl(passageKey, 'narration')
    if (hasAudio(passageKey)) return baiduReadingAudioUrl(passageKey)
    if (!baseUrl) return null
    return updatedAt ? `${baseUrl}?v=${encodeURIComponent(updatedAt)}` : baseUrl
  }, [isLoading, bound, hasAudio, passageKey, baseUrl, updatedAt])
}
