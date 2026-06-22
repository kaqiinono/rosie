'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import { compressAudioToMp3 } from '@/utils/audio-compress'
import {
  AUDIO_MEDIA_BUCKET,
  mediaAssetStoragePath,
  type AudioAsset,
  type MediaType,
} from '@rosie/player'

type RawRow = {
  id: string
  user_id: string
  label: string
  storage_path: string
  media_type: string
  duration_sec: number | null
  created_at: string
  updated_at: string
}

function rowToAsset(r: RawRow): AudioAsset {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    storagePath: r.storage_path,
    mediaType: (r.media_type ?? 'audio') as MediaType,
    durationSec: r.duration_sec,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function useAudioAssets(user: User | null) {
  const [assets, setAssets] = useState<AudioAsset[]>([])
  const [isLoading, setIsLoading] = useState(() => user !== null)

  const reload = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('audio_assets')
      .select('*')
      .order('created_at', { ascending: false })
    setAssets(((data ?? []) as RawRow[]).map(rowToAsset))
  }, [user])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await reload()
      if (!cancelled) setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  const getAssetUrl = useCallback((storagePath: string): string => {
    const { data } = supabase.storage.from(AUDIO_MEDIA_BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  }, [])

  const uploadAsset = useCallback(
    async (file: File): Promise<{ error: string | null; asset: AudioAsset | null }> => {
      if (!user) return { error: '请先登录', asset: null }

      const isVideo = file.type.startsWith('video/')
      const mediaType: MediaType = isVideo ? 'video' : 'audio'
      const ext = isVideo ? (file.name.split('.').pop() ?? 'mp4') : 'mp3'

      const { data: placeholder, error: insertErr } = await supabase
        .from('audio_assets')
        .insert({
          user_id: user.id,
          label: file.name.replace(/\.[^.]+$/, ''),
          storage_path: 'pending',
          media_type: mediaType,
        })
        .select()
        .single()
      if (insertErr || !placeholder) return { error: insertErr?.message ?? '创建失败', asset: null }

      const assetId = (placeholder as RawRow).id
      const storagePath = mediaAssetStoragePath(assetId, ext)

      let uploadBlob: Blob
      let contentType: string
      if (isVideo) {
        uploadBlob = file
        contentType = file.type
      } else {
        const compressed = await compressAudioToMp3(file)
        uploadBlob = compressed.blob
        contentType = compressed.contentType
      }

      const { error: storageErr } = await supabase.storage
        .from(AUDIO_MEDIA_BUCKET)
        .upload(storagePath, uploadBlob, { upsert: true, contentType })

      if (storageErr) {
        await supabase.from('audio_assets').delete().eq('id', assetId)
        return { error: storageErr.message, asset: null }
      }

      const updatedAt = new Date().toISOString()
      const { data: updated, error: updateErr } = await supabase
        .from('audio_assets')
        .update({ storage_path: storagePath, updated_at: updatedAt })
        .eq('id', assetId)
        .select()
        .single()
      if (updateErr || !updated) return { error: updateErr?.message ?? '更新失败', asset: null }

      const asset = rowToAsset(updated as RawRow)
      setAssets((prev) => [asset, ...prev])
      return { error: null, asset }
    },
    [user],
  )

  const updateLabel = useCallback(async (assetId: string, label: string): Promise<boolean> => {
    const { error } = await supabase
      .from('audio_assets')
      .update({ label, updated_at: new Date().toISOString() })
      .eq('id', assetId)
    if (error) return false
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, label } : a)))
    return true
  }, [])

  const deleteAsset = useCallback(async (asset: AudioAsset): Promise<boolean> => {
    if (asset.storagePath !== 'pending') {
      await supabase.storage.from(AUDIO_MEDIA_BUCKET).remove([asset.storagePath])
    }
    const { error } = await supabase.from('audio_assets').delete().eq('id', asset.id)
    if (error) return false
    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    return true
  }, [])

  return { assets, isLoading, reload, getAssetUrl, uploadAsset, updateLabel, deleteAsset }
}
