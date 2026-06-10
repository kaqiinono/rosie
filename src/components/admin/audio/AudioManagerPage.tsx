'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useAudioAssets } from '@/hooks/useAudioAssets'
import { useAudioCollections } from '@/hooks/useAudioCollections'
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer'
import StandaloneAudioTab from './StandaloneAudioTab'
import PlaylistSidebar from './PlaylistSidebar'
import PlayerDock from '@/components/audio/PlayerDock'
import {
  AUDIO_MEDIA_BUCKET,
  trackKey,
  type AddPlaylistItemInput,
  type AudioAsset,
  type AudioCollection,
  type PlayerTrack,
} from '@/utils/audio-manager-types'

type Props = { user: User | null }

function assetToTrack(asset: AudioAsset, url: string): PlayerTrack {
  return {
    url,
    label: asset.label,
    refLink: null,
    mediaType: asset.mediaType,
    source: assetToInput(asset),
  }
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
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('favorites')
  const [flash, setFlash] = useState<string | null>(null)

  const assetHook = useAudioAssets(user)
  const col = useAudioCollections(user)
  const player = usePlaylistPlayer()

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const selected = col.collections.find((c) => c.id === selectedCollectionId) ?? null
  const selectedName = selected?.name ?? null

  async function addAssetToCollection(asset: AudioAsset): Promise<boolean> {
    if (!selected || !selected.acceptsItems) {
      showFlash('请先选择「我的最爱」或某个歌单')
      return false
    }
    const plId = resolvePlaylistId(selected, col.favoriteId)
    if (!plId) return false
    const ok = await col.addItem(plId, assetToInput(asset))
    if (ok) showFlash(`已加入「${selected.name}」`)
    return ok
  }

  const current = player.current
  const currentIsFavorite =
    !!current?.source &&
    col.favoriteKeySet.has(trackKey(current.source.storageBucket, current.source.storagePath))

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
          selectedId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
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
            if (selectedCollectionId === c.id) setSelectedCollectionId('favorites')
          }}
          onPlay={(c) => {
            if (c.tracks.length === 0) {
              showFlash('收藏夹为空')
              return
            }
            setSelectedCollectionId(c.id)
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
          <StandaloneAudioTab
            assets={assetHook.assets}
            isLoading={assetHook.isLoading}
            getAssetUrl={assetHook.getAssetUrl}
            onPlayAsset={(asset) => player.play([assetToTrack(asset, assetHook.getAssetUrl(asset.storagePath))])}
            onUpload={async (file) => {
              const { error, asset } = await assetHook.uploadAsset(file)
              if (error) {
                showFlash(`上传失败：${error}`)
                return
              }
              if (asset && selected?.acceptsItems) {
                const plId = resolvePlaylistId(selected, col.favoriteId)
                if (plId) {
                  const ok = await col.addItem(plId, assetToInput(asset))
                  if (ok) showFlash(`已加入「${selected.name}」`)
                }
              }
            }}
            onDelete={async (asset) => {
              await assetHook.deleteAsset(asset)
            }}
            onRename={async (id, label) => {
              await assetHook.updateLabel(id, label)
            }}
            onAddAssetToCollection={(asset) => void addAssetToCollection(asset)}
            selectedCollectionName={selected?.acceptsItems ? selectedName : null}
            membership={col.membership}
            onRemoveItem={(item) => void col.removeItem(item)}
          />
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
