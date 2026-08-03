'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import {
  CHINESE_READING_RECORDINGS_BUCKET,
  buildRecordingStoragePath,
  parseRecordingRows,
  type ChineseReadingRecording,
  type RawRecordingRow,
} from '../utils/chinese-reading-recording-helpers'

async function fetchChineseReadingRecordings(userId: string): Promise<ChineseReadingRecording[]> {
  const { data, error } = await supabase
    .from('chinese_reading_recordings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return parseRecordingRows(data as RawRecordingRow[])
}

export const chineseReadingRecordingsStore = createUserSessionStore<ChineseReadingRecording[]>(
  'chinese_reading_recordings',
  {
    fetch: fetchChineseReadingRecordings,
    empty: [],
  },
)

export function useChineseReadingRecordings(user: User | null) {
  const { data: recordings, isLoading } = chineseReadingRecordingsStore.useSessionData(user)

  const uploadRecording = useCallback(
    async (args: {
      bookSlug: string
      lessonKey: string
      lessonTitle: string
      blob: Blob
      mimeType: string
      durationMs: number | null
    }): Promise<{ error: string | null; recording: ChineseReadingRecording | null }> => {
      if (!user) return { error: '请先登录', recording: null }

      const path = buildRecordingStoragePath({
        userId: user.id,
        bookSlug: args.bookSlug,
        lessonKey: args.lessonKey,
        mimeType: args.mimeType,
      })

      const { error: storageErr } = await supabase.storage
        .from(CHINESE_READING_RECORDINGS_BUCKET)
        .upload(path, args.blob, { contentType: args.mimeType, upsert: false })
      if (storageErr) return { error: storageErr.message, recording: null }

      const { data: inserted, error: insertErr } = await supabase
        .from('chinese_reading_recordings')
        .insert({
          user_id: user.id,
          book_slug: args.bookSlug,
          lesson_key: args.lessonKey,
          lesson_title: args.lessonTitle,
          storage_path: path,
          mime_type: args.mimeType,
          duration_ms: args.durationMs,
        })
        .select('*')
        .single()

      if (insertErr || !inserted) {
        await supabase.storage.from(CHINESE_READING_RECORDINGS_BUCKET).remove([path])
        return { error: insertErr?.message ?? '保存失败', recording: null }
      }

      const [recording] = parseRecordingRows([inserted as RawRecordingRow])
      chineseReadingRecordingsStore.patchSessionData(user.id, (prev) => [recording, ...prev])
      return { error: null, recording }
    },
    [user],
  )

  const deleteRecording = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }

      const existing = recordings.find((r) => r.id === id)
      if (!existing) return { error: '录音不存在' }

      const { error: dbErr } = await supabase
        .from('chinese_reading_recordings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (dbErr) return { error: dbErr.message }

      await supabase.storage.from(CHINESE_READING_RECORDINGS_BUCKET).remove([existing.storagePath])
      chineseReadingRecordingsStore.patchSessionData(user.id, (prev) =>
        prev.filter((r) => r.id !== id),
      )
      return { error: null }
    },
    [user, recordings],
  )

  const getSignedPlaybackUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(CHINESE_READING_RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, 3600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [])

  return { recordings, isLoading, uploadRecording, deleteRecording, getSignedPlaybackUrl }
}
