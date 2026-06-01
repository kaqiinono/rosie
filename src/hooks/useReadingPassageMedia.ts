'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { readingPassages } from '@/utils/reading-data'
import {
  READING_AUDIO_BUCKET,
  readingAudioContentType,
  readingPassageAudioPath,
  type ReadingPassageMediaRow,
} from '@/utils/reading-audio-types'

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

/** 仅 Storage 有文件、表里没有行时仍能播放（如控制台直传）。 */
async function discoverStorageAudio(): Promise<Record<string, ReadingPassageMediaRow>> {
  const map: Record<string, ReadingPassageMediaRow> = {}
  await Promise.all(
    readingPassages.map(async (p) => {
      const audioPath = readingPassageAudioPath(p.key)
      const { data, error } = await supabase.storage
        .from(READING_AUDIO_BUCKET)
        .list(`passages/${p.key}`, { limit: 5 })
      if (error || !data?.some((f) => f.name === 'narration.mp3')) return
      const file = data.find((f) => f.name === 'narration.mp3')
      map[p.key] = {
        passageKey: p.key,
        audioPath,
        updatedAt: file?.updated_at ?? file?.created_at ?? 'storage',
      }
    }),
  )
  return map
}

function mergeMediaMaps(
  storageMap: Record<string, ReadingPassageMediaRow>,
  dbMap: Record<string, ReadingPassageMediaRow>,
): Record<string, ReadingPassageMediaRow> {
  return { ...storageMap, ...dbMap }
}

export function useReadingPassageMedia(user: User | null) {
  const [mediaByKey, setMediaByKey] = useState<Record<string, ReadingPassageMediaRow>>({})
  const [isLoading, setIsLoading] = useState(() => user !== null)

  const reload = useCallback(async () => {
    if (!user) return
    const storageMap = await discoverStorageAudio()
    const { data, error } = await supabase
      .from('reading_passage_media')
      .select('passage_key, audio_path, updated_at')
    const dbMap: Record<string, ReadingPassageMediaRow> = {}
    if (!error && data) {
      for (const row of data as RawMediaRow[]) {
        dbMap[row.passage_key] = rowToMedia(row)
      }
    }
    setMediaByKey(mergeMediaMaps(storageMap, dbMap))
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const storageMap = await discoverStorageAudio()
      const { data, error } = await supabase
        .from('reading_passage_media')
        .select('passage_key, audio_path, updated_at')
      if (!cancelled) {
        const dbMap: Record<string, ReadingPassageMediaRow> = {}
        if (!error && data) {
          for (const row of data as RawMediaRow[]) {
            dbMap[row.passage_key] = rowToMedia(row)
          }
        }
        setMediaByKey(mergeMediaMaps(storageMap, dbMap))
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const getAudioUrl = useCallback((audioPath: string): string | null => {
    const { data } = supabase.storage.from(READING_AUDIO_BUCKET).getPublicUrl(audioPath)
    return data.publicUrl ?? null
  }, [])

  const getUrlForPassage = useCallback(
    (passageKey: string): string | null => {
      const media = mediaByKey[passageKey]
      if (!media) return null
      const base = getAudioUrl(media.audioPath)
      if (!base) return null
      return `${base}?v=${encodeURIComponent(media.updatedAt)}`
    },
    [mediaByKey, getAudioUrl],
  )

  const uploadPassageAudio = useCallback(
    async (passageKey: string, file: File): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }

      const audioPath = readingPassageAudioPath(passageKey)
      const { error: storageErr } = await supabase.storage
        .from(READING_AUDIO_BUCKET)
        .upload(audioPath, file, {
          upsert: true,
          contentType: readingAudioContentType(file),
        })
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
      setMediaByKey((prev) => ({
        ...prev,
        [passageKey]: { passageKey, audioPath, updatedAt },
      }))
      if (dbErr) {
        return {
          error: `音频已上传，但记录保存失败（请执行 docs/reading-audio-tables.sql）：${dbErr.message}`,
        }
      }
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
