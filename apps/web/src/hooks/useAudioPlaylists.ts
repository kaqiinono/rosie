'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type {
  AddPlaylistItemInput,
  AudioPlaylist,
  AudioPlaylistItem,
  MediaType,
} from '@/utils/audio-manager-types'

type RawPlaylist = {
  id: string
  user_id: string
  name: string
  is_favorite: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

type RawItem = {
  id: string
  playlist_id: string
  user_id: string
  item_type: string
  media_type: string
  label: string
  storage_bucket: string
  storage_path: string
  ref_link: string | null
  asset_id: string | null
  sort_order: number
  created_at: string
}

function rowToPlaylist(r: RawPlaylist): AudioPlaylist {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    isFavorite: r.is_favorite ?? false,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToItem(r: RawItem): AudioPlaylistItem {
  return {
    id: r.id,
    playlistId: r.playlist_id,
    userId: r.user_id,
    itemType: r.item_type as AudioPlaylistItem['itemType'],
    mediaType: (r.media_type ?? 'audio') as MediaType,
    label: r.label,
    storageBucket: r.storage_bucket,
    storagePath: r.storage_path,
    refLink: r.ref_link,
    assetId: r.asset_id,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

export function useAudioPlaylists(user: User | null) {
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([])
  const [itemsByPlaylist, setItemsByPlaylist] = useState<Record<string, AudioPlaylistItem[]>>({})

  const reload = useCallback(async () => {
    if (!user) return
    const [{ data: pRows }, { data: iRows }] = await Promise.all([
      supabase.from('audio_playlists').select('*').order('sort_order').order('created_at'),
      supabase.from('audio_playlist_items').select('*').order('sort_order').order('created_at'),
    ])
    setPlaylists(((pRows ?? []) as RawPlaylist[]).map(rowToPlaylist))
    const map: Record<string, AudioPlaylistItem[]> = {}
    for (const r of (iRows ?? []) as RawItem[]) {
      const item = rowToItem(r)
      ;(map[item.playlistId] ??= []).push(item)
    }
    setItemsByPlaylist(map)
  }, [user])

  useEffect(() => {
    if (user) void reload()
  }, [reload, user])

  const createPlaylist = useCallback(
    async (name: string): Promise<AudioPlaylist | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('audio_playlists')
        .insert({ user_id: user.id, name, sort_order: playlists.length })
        .select()
        .single()
      if (error || !data) return null
      const p = rowToPlaylist(data as RawPlaylist)
      setPlaylists((prev) => [...prev, p])
      setItemsByPlaylist((prev) => ({ ...prev, [p.id]: [] }))
      return p
    },
    [user, playlists.length],
  )

  const renamePlaylist = useCallback(async (id: string, name: string): Promise<boolean> => {
    const { error } = await supabase
      .from('audio_playlists')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return false
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
    return true
  }, [])

  const deletePlaylist = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('audio_playlists').delete().eq('id', id)
    if (error) return false
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
    setItemsByPlaylist((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
    return true
  }, [])

  const addItem = useCallback(
    async (playlistId: string, input: AddPlaylistItemInput): Promise<boolean> => {
      if (!user) return false
      const existing = itemsByPlaylist[playlistId] ?? []
      // Prevent duplicate in the same playlist (same bucket + path)
      if (
        existing.some(
          (i) => i.storageBucket === input.storageBucket && i.storagePath === input.storagePath,
        )
      ) {
        return true
      }
      const { data, error } = await supabase
        .from('audio_playlist_items')
        .insert({
          playlist_id: playlistId,
          user_id: user.id,
          item_type: input.itemType,
          media_type: input.mediaType,
          label: input.label,
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          ref_link: input.refLink,
          asset_id: input.assetId,
          sort_order: existing.length,
        })
        .select()
        .single()
      if (error || !data) return false
      const item = rowToItem(data as RawItem)
      setItemsByPlaylist((prev) => ({
        ...prev,
        [playlistId]: [...(prev[playlistId] ?? []), item],
      }))
      return true
    },
    [user, itemsByPlaylist],
  )

  const removeItem = useCallback(async (item: AudioPlaylistItem): Promise<boolean> => {
    const { error } = await supabase.from('audio_playlist_items').delete().eq('id', item.id)
    if (error) return false
    setItemsByPlaylist((prev) => ({
      ...prev,
      [item.playlistId]: (prev[item.playlistId] ?? []).filter((i) => i.id !== item.id),
    }))
    return true
  }, [])

  return {
    playlists,
    itemsByPlaylist,
    reload,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addItem,
    removeItem,
  }
}
