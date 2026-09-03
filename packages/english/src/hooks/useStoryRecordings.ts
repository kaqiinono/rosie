'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import { compressAudioToMp3 } from '@rosie/player'
import {
  STORY_RECORDINGS_BUCKET,
  mapStoryRecording,
  storyRecordingStoragePath,
  type RawStoryRecordingRow,
  type StoryRecording,
  type StoryRecordingScope,
} from '../utils/story-recording-types'

const SIGNED_URL_TTL_SECONDS = 60 * 60

async function fetchRecordings(userId: string): Promise<StoryRecording[]> {
  const { data, error } = await supabase
    .from('reading_recordings')
    .select('id, content_key, scope, title, storage_path, mime_type, duration_ms, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as RawStoryRecordingRow[]).map(mapStoryRecording)
}

export const storyRecordingsStore = createUserSessionStore<StoryRecording[]>('story_recordings', {
  fetch: fetchRecordings,
  empty: [],
})

export function useStoryRecordings(user: User | null) {
  const { data: recordings, isLoading } = storyRecordingsStore.useSessionData(user)

  const recordingsFor = useCallback(
    (contentKey: string, scope: StoryRecordingScope) =>
      recordings.filter((entry) => entry.contentKey === contentKey && entry.scope === scope),
    [recordings],
  )

  const saveRecording = useCallback(
    async (args: {
      contentKey: string
      scope: StoryRecordingScope
      title: string
      blob: Blob
      mimeType: string
      durationMs: number | null
    }): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }
      const file = new File([args.blob], 'reading.webm', { type: args.mimeType })
      const compressed = await compressAudioToMp3(file)
      const contentType = compressed.contentType.split(';')[0]?.trim() || 'audio/webm'
      const extension =
        contentType === 'audio/mpeg' ? 'mp3' : contentType === 'audio/mp4' ? 'mp4' : 'webm'
      if (compressed.blob.size > 50 * 1024 * 1024) {
        return { error: '录音压缩后仍超过 50 MB，请分章录制' }
      }
      const recordingId = crypto.randomUUID()
      const storagePath = storyRecordingStoragePath({
        userId: user.id,
        scope: args.scope,
        contentKey: args.contentKey,
        recordingId,
        extension,
      })
      const { error: uploadError } = await supabase.storage
        .from(STORY_RECORDINGS_BUCKET)
        .upload(storagePath, compressed.blob, {
          contentType,
          upsert: true,
        })
      if (uploadError) return { error: uploadError.message }

      const updatedAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('reading_recordings')
        .insert({
          id: recordingId,
          user_id: user.id,
          content_key: args.contentKey,
          scope: args.scope,
          title: args.title,
          storage_path: storagePath,
          mime_type: contentType,
          duration_ms: args.durationMs,
          updated_at: updatedAt,
        })
        .select('id, content_key, scope, title, storage_path, mime_type, duration_ms, updated_at')
        .single()
      if (error || !data) return { error: error?.message ?? '录音记录保存失败' }
      const saved = mapStoryRecording(data as RawStoryRecordingRow)
      storyRecordingsStore.patchSessionData(user.id, (prev) => [saved, ...prev])
      return { error: null }
    },
    [user],
  )

  const deleteRecording = useCallback(
    async (recording: StoryRecording): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }
      const { error } = await supabase
        .from('reading_recordings')
        .delete()
        .eq('id', recording.id)
        .eq('user_id', user.id)
      if (error) return { error: error.message }
      await supabase.storage.from(STORY_RECORDINGS_BUCKET).remove([recording.storagePath])
      storyRecordingsStore.patchSessionData(user.id, (prev) =>
        prev.filter((entry) => entry.id !== recording.id),
      )
      return { error: null }
    },
    [user],
  )

  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(STORY_RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
    return error ? null : (data?.signedUrl ?? null)
  }, [])

  return { recordings, isLoading, recordingsFor, saveRecording, deleteRecording, getSignedUrl }
}
