'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useAudioAssets } from '@/hooks/useAudioAssets'
import { useAudioCollections } from '@/hooks/useAudioCollections'
import { usePlaylistPlayer } from '@rosie/player'
import StandaloneAudioTab from './StandaloneAudioTab'
import PlaylistSidebar from './PlaylistSidebar'
import CollectionView from './CollectionView'
import { PlayerDock } from '@rosie/player'
import {
  AUDIO_MEDIA_BUCKET,
  trackKey,
  type AddPlaylistItemInput,
  type AudioAsset,
  type AudioCollection,
  type AudioPlaylistItem,
  type PlayerTrack,
} from '@rosie/player'

type Props = { user: User | null }

function assetToTrack(asset: AudioAsset, url: string): PlayerTrack {
  return { url, label: asset.label, refLink: null, mediaType: asset.mediaType, source: assetToInput(asset) }
}

function assetToInput(asset: AudioAsset): AddPlaylistItemInput {
  return {
    itemType: 'standalone',
    mediaType: asset.mediaType,
    label: asset.label,
    storageBucket: AUDIO_MEDIA_BUCKET,
    storagePath: asset.storagePath,
    refLink: null,
    assetId: asset.id,
  }
}

/** 把 `pl:uuid` / `favorites` 解析成真实 audio_playlists 行 id（虚拟收藏夹返回 null）。 */
function resolvePlaylistId(c: AudioCollection, favoriteId: string | null): string | null {
  if (c.id === 'favorites') return favoriteId
  if (c.id.startsWith('pl:')) return c.id.slice(3)
  return null
}

export default function AudioManagerPage({ user }: Props) {
  // 'library' = 独立媒体库；其余为收藏夹 id
  const [selectedId, setSelectedId] = useState<string>('library')
  const [flash, setFlash] = useState<string | null>(null)
  const [pendingAsset, setPendingAsset] = useState<AudioAsset | null>(null)

  const assetHook = useAudioAssets(user)
  const col = useAudioCollections(user)
  const player = usePlaylistPlayer()

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const isLibrary = selectedId === 'library'
  const selected = isLibrary ? null : col.collections.find((c) => c.id === selectedId) ?? null

  const current = player.current
  const currentKey =
    current?.source ? trackKey(current.source.storageBucket, current.source.storagePath) : null
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

  async function confirmAddToCollection(c: AudioCollection) {
    if (!pendingAsset) return
    const realId = resolvePlaylistId(c, col.favoriteId)
    if (realId) {
      const ok = await col.addItem(realId, assetToInput(pendingAsset))
      if (ok) showFlash(`已加入「${c.name}」`)
    }
    setPendingAsset(null)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-4xl opacity-30">🔐</div>
        <div className="text-sm text-slate-500">请先登录</div>
        <Link
          href="/auth"
          className="rounded-full px-4 py-2 text-[13px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
        >
          去登录
        </Link>
      </div>
    )
  }

  const addTargets = col.collections.filter((c) => c.acceptsItems)

  return (
    <div
      className="min-h-screen pb-28"
      style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fdf4ff 40%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid rgba(245,158,11,0.15)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[960px] items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)' }}
            aria-label="返回首页"
          >
            ←
          </Link>
          <div>
            <div className="text-[17px] font-extrabold text-amber-900">媒体管理</div>
            <div className="text-[10px] font-semibold text-amber-500/70">独立媒体 · 收藏夹</div>
          </div>
          {flash && (
            <div
              className="ml-auto animate-pulse rounded-full px-3 py-1 text-[12px] font-extrabold text-emerald-700"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)' }}
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
            if (selectedId === c.id) setSelectedId('library')
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
          {isLibrary ? (
            <StandaloneAudioTab
              assets={assetHook.assets}
              isLoading={assetHook.isLoading}
              getAssetUrl={assetHook.getAssetUrl}
              onPlayAsset={(asset) =>
                player.play([assetToTrack(asset, assetHook.getAssetUrl(asset.storagePath))])
              }
              onUpload={async (file) => {
                const { error } = await assetHook.uploadAsset(file)
                if (error) showFlash(`上传失败：${error}`)
              }}
              onDelete={async (asset) => {
                await assetHook.deleteAsset(asset)
              }}
              onRename={async (id, label) => {
                await assetHook.updateLabel(id, label)
              }}
              onAddAssetToCollection={(asset) => {
                if (addTargets.length === 0) {
                  showFlash('请先创建收藏夹')
                  return
                }
                setPendingAsset(asset)
              }}
              membership={col.membership}
              onRemoveItem={(item) => void col.removeItem(item)}
            />
          ) : selected ? (
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
              onUpload={
                selected.acceptsItems
                  ? async (file) => {
                      const { error, asset } = await assetHook.uploadAsset(file)
                      if (error) {
                        showFlash(`上传失败：${error}`)
                        return
                      }
                      const realId = resolvePlaylistId(selected, col.favoriteId)
                      if (asset && realId) {
                        const ok = await col.addItem(realId, assetToInput(asset))
                        if (ok) showFlash(`已加入「${selected.name}」`)
                      }
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      </main>

      {/* 加入收藏夹 选择器 */}
      {pendingAsset && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingAsset(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl"
            style={{ border: '1.5px solid rgba(245,158,11,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[15px] font-extrabold text-slate-800">加入收藏夹</div>
            <div
              className="mb-4 truncate rounded-lg px-3 py-1.5 text-[12px] text-slate-600"
              style={{ background: 'rgba(245,158,11,0.08)' }}
            >
              {pendingAsset.mediaType === 'video' ? '🎬' : '🎵'} {pendingAsset.label}
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {addTargets.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void confirmAddToCollection(c)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-amber-50"
                  style={{ border: '1px solid rgba(15,23,42,0.06)' }}
                >
                  <span className="shrink-0">{c.kind === 'favorites' ? '❤️' : '🎵'}</span>
                  <span className="flex-1 truncate text-[13px] font-bold text-slate-700">{c.name}</span>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                    style={{ background: 'rgba(245,158,11,0.1)' }}
                  >
                    {c.tracks.length} 首
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
