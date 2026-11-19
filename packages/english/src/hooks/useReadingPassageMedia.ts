'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, projectMediaUrl, removeProjectMedia, supabase, uploadProjectMedia } from '@rosie/core'
import {
  READING_AUDIO_BUCKET,
  readingPassageAudioPath,
  type ReadingPassageMediaRow,
} from '../utils/reading-audio-types'
import { compressAudioToMp3 } from '@rosie/player'

type RawMediaRow = {
  passage_key: string
  audio_path: string
  updated_at: string
}

function rowToMedia(row: RawMediaRow): ReadingPassageMediaRow {
  return {
    passageKey: row.passage_key,
    audioPath: row.audio_path,
    updatedAt: row.updated_at,
  }
}

async function fetchReadingPassageMedia(_userId: string): Promise<Record<string, ReadingPassageMediaRow>> {
  const { data, error } = await supabase
    .from('reading_passage_media')
    .select('passage_key, audio_path, updated_at')
  const dbMap: Record<string, ReadingPassageMediaRow> = {}
  if (!error && data) {
    for (const row of data as RawMediaRow[]) {
      dbMap[row.passage_key] = rowToMedia(row)
    }
  }
  return dbMap
}

export const readingPassageMediaStore = createUserSessionStore<
  Record<string, ReadingPassageMediaRow>
>('reading_passage_media', {
  fetch: fetchReadingPassageMedia,
  empty: {},
})

export function useReadingPassageMedia(user: User | null) {
  const { data: mediaByKey, isLoading } = readingPassageMediaStore.useSessionData(user)

  const reload = useCallback(async () => {
    if (!user) return
    readingPassageMediaStore.invalidate(user.id)
    readingPassageMediaStore.ensureLoaded(user.id)
  }, [user])

  const getAudioUrl = useCallback((audioPath: string) => projectMediaUrl(READING_AUDIO_BUCKET, audioPath), [])

  const getUrlForPassage = useCallback(
    (passageKey: string): string | null => {
      const media = mediaByKey[passageKey]
      if (!media) return null
      const base = getAudioUrl(media.audioPath)
      return `${base}?v=${encodeURIComponent(media.updatedAt)}`
    },
    [mediaByKey, getAudioUrl],
  )

  const uploadPassageAudio = useCallback(
    async (passageKey: string, file: File): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }

      const compressed = await compressAudioToMp3(file)
      const audioPath = readingPassageAudioPath(passageKey).replace(/\.mp3$/, `-${crypto.randomUUID()}.mp3`)
      const { error: storageErr } = await uploadProjectMedia(READING_AUDIO_BUCKET, audioPath, compressed.blob)
      if (storageErr) return { error: storageErr.message }

      const updatedAt = new Date().toISOString()
      const { error: dbErr } = await supabase.from('reading_passage_media').upsert(
        {
          passage_key: passageKey,
          audio_path: audioPath,
          user_id: user.id,
          updated_at: updatedAt,
        },
        { onConflict: 'passage_key' },
      )
      if (dbErr) {
        await removeProjectMedia(READING_AUDIO_BUCKET, audioPath)
        return { error: dbErr.message }
      }
      readingPassageMediaStore.patchSessionData(user.id, (prev) => ({
        ...prev,
        [passageKey]: { passageKey, audioPath, updatedAt },
      }))
      return { error: null }
    },
    [user],
  )

  const hasAudio = useCallback(
    (passageKey: string): boolean => Boolean(mediaByKey[passageKey]),
    [mediaByKey],
  )

  return {
    mediaByKey,
    isLoading,
    reload,
    getAudioUrl,
    getUrlForPassage,
    hasAudio,
    uploadPassageAudio,
  }
}
