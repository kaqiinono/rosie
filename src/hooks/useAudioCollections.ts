'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useReadingPassageMedia } from '@/hooks/useReadingPassageMedia'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import { useAudioPlaylists } from '@/hooks/useAudioPlaylists'
import { readingPassages } from '@/utils/reading-data'
import { READING_AUDIO_BUCKET } from '@/utils/reading-audio-types'
import { FLIPBOOK_BUCKET } from '@/utils/flipbook-types'
import {
  AUDIO_MEDIA_BUCKET,
  trackKey,
  type AddPlaylistItemInput,
  type AudioCollection,
  type AudioPlaylistItem,
  type PlayerTrack,
} from '@/utils/audio-manager-types'

const FAVORITES_NAME = '我的最爱'

function itemToTrack(item: AudioPlaylistItem): PlayerTrack {
  const url = supabase.storage.from(item.storageBucket).getPublicUrl(item.storagePath).data
    .publicUrl
  return {
    url,
    label: item.label,
    refLink: item.refLink,
    mediaType: item.mediaType,
    source: {
      itemType: item.itemType,
      mediaType: item.mediaType,
      label: item.label,
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      refLink: item.refLink,
      assetId: item.assetId,
    },
  }
}

export type CollectionMembership = {
  collectionId: string
  collectionName: string
  kind: string
  item: AudioPlaylistItem
}

export function useAudioCollections(user: User | null) {
  const reading = useReadingPassageMedia(user)
  const flipbook = useFlipbookBooks(user)
  const playlists = useAudioPlaylists(user)
  const [favoriteId, setFavoriteId] = useState<string | null>(null)
  const creatingFavoriteRef = useRef(false)

  const userPlaylists = playlists.playlists
  const reloadPlaylists = playlists.reload

  // 找/建 favorites 歌单（新用户可能一个歌单都没有，故不在 length===0 时提前返回；
  // 唯一索引 audio_playlists_one_favorite_per_user + creatingFavoriteRef 保证只建一条）
  useEffect(() => {
    if (!user) return
    const existing = userPlaylists.find((p) => p.isFavorite)
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavoriteId(existing.id)
      creatingFavoriteRef.current = false
      return
    }
    // 没有 favorites 行：只尝试创建一次（唯一索引兜底并发）
    if (creatingFavoriteRef.current) return
    creatingFavoriteRef.current = true
    void (async () => {
      const { data } = await supabase
        .from('audio_playlists')
        .insert({ user_id: user.id, name: FAVORITES_NAME, is_favorite: true, sort_order: -1 })
        .select()
        .single()
      await reloadPlaylists()
      if (data) setFavoriteId((data as { id: string }).id)
    })()
  }, [user, userPlaylists, reloadPlaylists])

  // reading 虚拟收藏夹
  const readingTracks = useMemo<PlayerTrack[]>(() => {
    return readingPassages
      .filter((p) => reading.hasAudio(p.key))
      .map((p): PlayerTrack | null => {
        const url = reading.getUrlForPassage(p.key)
        const media = reading.mediaByKey[p.key]
        if (!url || !media) return null
        const refLink = `/english/words/reading/${p.key}`
        const source: AddPlaylistItemInput = {
          itemType: 'reading',
          mediaType: 'audio',
          label: p.title,
          storageBucket: READING_AUDIO_BUCKET,
          storagePath: media.audioPath,
          refLink,
          assetId: null,
        }
        return { url, label: p.title, refLink, mediaType: 'audio' as const, source }
      })
      .filter((t): t is PlayerTrack => t !== null)
  }, [reading])

  // flipbook 虚拟收藏夹
  const flipbookTracks = useMemo<PlayerTrack[]>(() => {
    return flipbook.books
      .filter((b) => b.audioPath)
      .map((b) => {
        const path = b.audioPath as string
        const url = supabase.storage.from(FLIPBOOK_BUCKET).getPublicUrl(path).data.publicUrl
        const refLink = `/flipbook/${b.id}`
        const source: AddPlaylistItemInput = {
          itemType: 'flipbook',
          mediaType: 'audio',
          label: b.title,
          storageBucket: FLIPBOOK_BUCKET,
          storagePath: path,
          refLink,
          assetId: null,
        }
        return { url, label: b.title, refLink, mediaType: 'audio' as const, source }
      })
  }, [flipbook.books])

  const collections = useMemo<AudioCollection[]>(() => {
    const favItems = favoriteId ? playlists.itemsByPlaylist[favoriteId] ?? [] : []
    const presets: AudioCollection[] = [
      {
        id: 'favorites',
        name: FAVORITES_NAME,
        kind: 'favorites',
        removable: false,
        acceptsItems: true,
        tracks: favItems.map(itemToTrack),
      },
      {
        id: 'reading',
        name: '阅读',
        kind: 'reading',
        removable: false,
        acceptsItems: false,
        tracks: readingTracks,
      },
      {
        id: 'flipbook',
        name: '绘本',
        kind: 'flipbook',
        removable: false,
        acceptsItems: false,
        tracks: flipbookTracks,
      },
    ]
    const userPls: AudioCollection[] = playlists.playlists
      .filter((p) => !p.isFavorite)
      .map((p) => ({
        id: `pl:${p.id}` as const,
        name: p.name,
        kind: 'playlist' as const,
        removable: true,
        acceptsItems: true,
        tracks: (playlists.itemsByPlaylist[p.id] ?? []).map(itemToTrack),
      }))
    return [...presets, ...userPls]
  }, [favoriteId, playlists.playlists, playlists.itemsByPlaylist, readingTracks, flipbookTracks])

  const favoriteKeySet = useMemo<Set<string>>(() => {
    if (!favoriteId) return new Set()
    const items = playlists.itemsByPlaylist[favoriteId] ?? []
    return new Set(items.map((i) => trackKey(i.storageBucket, i.storagePath)))
  }, [favoriteId, playlists.itemsByPlaylist])

  const toggleFavorite = useCallback(
    async (track: PlayerTrack): Promise<void> => {
      if (!favoriteId || !track.source) return
      const key = trackKey(track.source.storageBucket, track.source.storagePath)
      const items = playlists.itemsByPlaylist[favoriteId] ?? []
      const existing = items.find((i) => trackKey(i.storageBucket, i.storagePath) === key)
      if (existing) await playlists.removeItem(existing)
      else await playlists.addItem(favoriteId, track.source)
    },
    [favoriteId, playlists],
  )

  const membership = useCallback(
    (bucket: string, path: string): CollectionMembership[] => {
      const key = trackKey(bucket, path)
      const out: CollectionMembership[] = []
      for (const p of playlists.playlists) {
        const items = playlists.itemsByPlaylist[p.id] ?? []
        const item = items.find((i) => trackKey(i.storageBucket, i.storagePath) === key)
        if (item) {
          out.push({
            collectionId: p.id,
            collectionName: p.isFavorite ? FAVORITES_NAME : p.name,
            kind: p.isFavorite ? 'favorites' : 'playlist',
            item,
          })
        }
      }
      return out
    },
    [playlists.playlists, playlists.itemsByPlaylist],
  )

  const isLoading = reading.isLoading || flipbook.isLoading

  return {
    collections,
    isLoading,
    favoriteId,
    favoriteKeySet,
    toggleFavorite,
    membership,
    createPlaylist: playlists.createPlaylist,
    renamePlaylist: playlists.renamePlaylist,
    deletePlaylist: playlists.deletePlaylist,
    addItem: playlists.addItem,
    removeItem: playlists.removeItem,
    reloadPlaylists: playlists.reload,
  }
}
