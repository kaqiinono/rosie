'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAudioAssets } from '@/hooks/useAudioAssets'
import { useAudioPlaylists } from '@/hooks/useAudioPlaylists'
import ReadingAudioTab from './ReadingAudioTab'
import FlipbookAudioTab from './FlipbookAudioTab'
import StandaloneAudioTab from './StandaloneAudioTab'
import PlaylistSidebar from './PlaylistSidebar'
import AudioPlayerBar from './AudioPlayerBar'
import type {
  AddPlaylistItemInput,
  AudioPlaylist,
  MediaType,
  PlayerState,
} from '@/utils/audio-manager-types'

type Tab = 'reading' | 'flipbook' | 'standalone'

const TABS: { id: Tab; label: string; color: string; activeGrad: string }[] = [
  { id: 'reading', label: '阅读朗读', color: '#f43f5e', activeGrad: 'linear-gradient(135deg,#f43f5e,#e11d48)' },
  { id: 'flipbook', label: '绘本', color: '#8b5cf6', activeGrad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  { id: 'standalone', label: '独立媒体', color: '#f59e0b', activeGrad: 'linear-gradient(135deg,#f59e0b,#b45309)' },
]

type Props = { user: User | null }

export default function AudioManagerPage({ user }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('reading')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState | null>(null)
  const [pendingAdd, setPendingAdd] = useState<AddPlaylistItemInput | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const assetHook = useAudioAssets(user)
  const playlistHook = useAudioPlaylists(user)

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  function playSingle(url: string, label: string, mediaType: MediaType) {
    setPlayerState({
      tracks: [{ url, label, refLink: null, mediaType }],
      currentIndex: 0,
      isPlaying: true,
      loopMode: 'none',
    })
  }

  function playPlaylist(playlistId: string) {
    const items = playlistHook.itemsByPlaylist[playlistId] ?? []
    if (items.length === 0) {
      showFlash('收藏夹为空')
      return
    }
    const tracks = items.map((i) => ({
      url: supabase.storage.from(i.storageBucket).getPublicUrl(i.storagePath).data.publicUrl,
      label: i.label,
      refLink: i.refLink,
      mediaType: i.mediaType,
    }))
    setPlayerState({ tracks, currentIndex: 0, isPlaying: true, loopMode: 'all' })
    setSelectedPlaylistId(playlistId)
  }

  async function handleAddToPlaylist(input: AddPlaylistItemInput) {
    if (playlistHook.playlists.length === 0) {
      showFlash('请先创建收藏夹')
      return
    }
    if (playlistHook.playlists.length === 1) {
      const pl = playlistHook.playlists[0]!
      const ok = await playlistHook.addItem(pl.id, input)
      if (ok) showFlash(`已加入「${pl.name}」`)
      return
    }
    setPendingAdd(input)
  }

  async function confirmAddToPlaylist(pl: AudioPlaylist) {
    if (!pendingAdd) return
    const ok = await playlistHook.addItem(pl.id, pendingAdd)
    if (ok) showFlash(`已加入「${pl.name}」`)
    setPendingAdd(null)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-4xl opacity-30">🔐</div>
        <div className="text-sm text-slate-500">请先登录</div>
        <Link href="/auth" className="rounded-full px-4 py-2 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
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
      {/* Header */}
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
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1.5px solid rgba(245,158,11,0.25)',
            }}
            aria-label="返回首页"
          >
            ←
          </Link>
          <div>
            <div className="text-[17px] font-extrabold text-amber-900">媒体管理</div>
            <div className="text-[10px] font-semibold text-amber-500/70">音频 & 视频</div>
          </div>

          {/* Flash message */}
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

      <main className="mx-auto flex max-w-[960px] gap-5 px-4 py-6">
        {/* Left sidebar */}
        <PlaylistSidebar
          playlists={playlistHook.playlists}
          itemsByPlaylist={playlistHook.itemsByPlaylist}
          selectedId={selectedPlaylistId}
          onSelect={setSelectedPlaylistId}
          onCreate={async (name) => {
            await playlistHook.createPlaylist(name)
            showFlash(`已创建「${name}」`)
          }}
          onRename={async (id, name) => {
            await playlistHook.renamePlaylist(id, name)
          }}
          onDelete={async (id) => {
            const pl = playlistHook.playlists.find((p) => p.id === id)
            if (!window.confirm(`确定删除收藏夹「${pl?.name ?? ''}」？`)) return
            await playlistHook.deletePlaylist(id)
            if (selectedPlaylistId === id) setSelectedPlaylistId(null)
          }}
          onRemoveItem={async (item) => {
            await playlistHook.removeItem(item)
          }}
          onPlayPlaylist={playPlaylist}
        />

        {/* Right content */}
        <div className="min-w-0 flex-1">
          {/* Tab strip */}
          <div
            className="mb-5 flex gap-1 rounded-2xl p-1"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px solid rgba(15,23,42,0.06)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="flex-1 cursor-pointer rounded-xl py-2.5 text-[13px] font-extrabold transition-all"
                style={
                  activeTab === t.id
                    ? {
                        background: t.activeGrad,
                        color: '#fff',
                        boxShadow: `0 3px 10px ${t.color}40`,
                      }
                    : { color: '#94a3b8' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'reading' && (
            <ReadingAudioTab user={user} onPlay={playSingle} onAddToPlaylist={handleAddToPlaylist} />
          )}
          {activeTab === 'flipbook' && (
            <FlipbookAudioTab user={user} onPlay={playSingle} onAddToPlaylist={handleAddToPlaylist} />
          )}
          {activeTab === 'standalone' && (
            <StandaloneAudioTab
              assets={assetHook.assets}
              isLoading={assetHook.isLoading}
              getAssetUrl={assetHook.getAssetUrl}
              onPlay={playSingle}
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
              onAddToPlaylist={handleAddToPlaylist}
            />
          )}
        </div>
      </main>

      {/* Playlist selector modal */}
      {pendingAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingAdd(null)}
        >
          <div
            className="w-72 rounded-3xl bg-white p-5 shadow-2xl"
            style={{ border: '1.5px solid rgba(245,158,11,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[15px] font-extrabold text-slate-800">加入收藏夹</div>
            <div
              className="mb-4 truncate rounded-lg px-3 py-1.5 text-[12px] text-slate-600"
              style={{ background: 'rgba(245,158,11,0.08)' }}
            >
              {pendingAdd.mediaType === 'video' ? '🎬' : '🎵'} {pendingAdd.label}
            </div>
            <div className="space-y-1">
              {playlistHook.playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => void confirmAddToPlaylist(pl)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-amber-50"
                  style={{ border: '1px solid rgba(15,23,42,0.06)' }}
                >
                  <span className="flex-1 text-[13px] font-bold text-slate-700">{pl.name}</span>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                    style={{ background: 'rgba(245,158,11,0.1)' }}
                  >
                    {(playlistHook.itemsByPlaylist[pl.id] ?? []).length} 首
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky player */}
      <AudioPlayerBar state={playerState} onStateChange={setPlayerState} />
    </div>
  )
}
