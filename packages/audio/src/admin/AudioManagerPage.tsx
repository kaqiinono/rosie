'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageBreadcrumb } from '@rosie/ui'
import type { User } from '@supabase/supabase-js'
import { useAudioCollections } from '../hooks/useAudioCollections'
import { usePlaylistPlayer } from '@rosie/player'
import PlaylistSidebar from './PlaylistSidebar'
import CollectionView from './CollectionView'
import { PlayerDock } from '@rosie/player'
import {
  trackKey,
  type AudioCollection,
  type AudioPlaylistItem,
  type PlayerTrack,
} from '@rosie/player'

/** 把 `pl:uuid` / `favorites` 解析成真实 audio_playlists 行 id（虚拟收藏夹返回 null）。 */
function resolvePlaylistId(c: AudioCollection, favoriteId: string | null): string | null {
  if (c.id === 'favorites') return favoriteId
  if (c.id.startsWith('pl:')) return c.id.slice(3)
  return null
}

export default function AudioManagerPage({ user }: { user: User | null }) {
  const [selectedId, setSelectedId] = useState('favorites')
  const [flash, setFlash] = useState<string | null>(null)

  const col = useAudioCollections(user)
  const player = usePlaylistPlayer()

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const selected = col.collections.find((c) => c.id === selectedId) ?? null

  const current = player.current
  const currentKey = current?.source
    ? trackKey(current.source.storageBucket, current.source.storagePath)
    : null
  const currentIsFavorite = currentKey !== null && col.favoriteKeySet.has(currentKey)

  // 选中收藏夹视图里某曲目对应的 item（虚拟收藏夹不可移除）
  function itemInSelected(track: PlayerTrack): AudioPlaylistItem | null {
    if (!selected || !selected.acceptsItems || !track.source) return null
    const realId = resolvePlaylistId(selected, col.favoriteId)
    if (!realId) return null
    const entry = col
      .membership(track.source.storageBucket, track.source.storagePath)
      .find((e) => e.collectionId === realId)
    return entry?.item ?? null
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-4xl opacity-30">🔐</div>
        <div className="text-sm text-slate-500">请先登录</div>
        <Link
          href="/auth"
          className="rounded-full px-4 py-2 text-[13px] font-bold text-white"
          style={{ background: '#6366f1' }}
        >
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fdf4ff' }}>
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid rgba(245,158,11,0.15)',
          boxShadow: '0 3px 0 rgba(0,0,0,.3)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[960px] items-center gap-3 px-4">
          <PageBreadcrumb variant="inline" />
          <div>
            <div className="text-[17px] font-extrabold text-amber-900">
              媒体收藏夹
            </div>
            <div className="text-[10px] font-semibold text-amber-500/70">
              我的最爱 · 自建收藏夹
            </div>
          </div>
          {flash && (
            <div
              className="ml-auto animate-pulse rounded-full px-3 py-1 text-[12px] font-extrabold text-emerald-700"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.35)',
              }}
            >
              ✓ {flash}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-6 md:flex-row md:gap-5">
        <PlaylistSidebar
          collections={col.collections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={async (name) => {
            await col.createPlaylist(name)
            showFlash(`已创建「${name}」`)
          }}
          onRename={async (c, name) => {
            const plId = resolvePlaylistId(c, col.favoriteId)
            if (plId) await col.renamePlaylist(plId, name)
          }}
          onDelete={async (c) => {
            const plId = resolvePlaylistId(c, col.favoriteId)
            if (!plId) return
            if (!window.confirm(`确定删除收藏夹「${c.name}」？`)) return
            await col.deletePlaylist(plId)
            if (selectedId === c.id) setSelectedId('favorites')
          }}
          onPlay={(c) => {
            if (c.tracks.length === 0) {
              showFlash('收藏夹为空')
              return
            }
            player.play(c.tracks)
          }}
          onEnqueue={(c) => {
            if (c.tracks.length === 0) {
              showFlash('收藏夹为空')
              return
            }
            player.enqueue(c.tracks)
            showFlash(`已加入播放列表（${c.tracks.length}）`)
          }}
        />

        <div className="min-w-0 flex-1">
          {selected ? (
            <CollectionView
              collection={selected}
              currentKey={currentKey}
              onPlayTrack={(track) => player.play([track])}
              onPlayAll={() => player.play(selected.tracks)}
              onEnqueueAll={() => {
                player.enqueue(selected.tracks)
                showFlash(`已加入播放列表（${selected.tracks.length}）`)
              }}
              getItem={itemInSelected}
              onRemove={(item) => void col.removeItem(item)}
            />
          ) : null}
        </div>
      </main>

      <PlayerDock
        player={player}
        theme="light"
        isFavorite={currentIsFavorite}
        onToggleFavorite={() => {
          if (player.current) void col.toggleFavorite(player.current)
        }}
      />
    </div>
  )
}
