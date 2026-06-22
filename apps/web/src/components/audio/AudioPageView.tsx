'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { User } from '@supabase/supabase-js'
import { useAudioCollections } from '@/hooks/useAudioCollections'
import { usePlaylistPlayer } from '@rosie/player'
import { PlayerDock } from '@rosie/player'
import CollectionPills from '@/components/audio/CollectionPills'
import { trackKey, type AudioCollection, type AudioCollectionKind } from '@rosie/player'

const KIND_ICON: Record<AudioCollectionKind, string> = {
  favorites: '❤️',
  reading: '📖',
  flipbook: '📚',
  playlist: '🎵',
}

type Props = { user: User | null }

export default function AudioPageView({ user }: Props) {
  const col = useAudioCollections(user)
  const player = usePlaylistPlayer()
  const [selectedId, setSelectedId] = useState<string>('favorites')

  const selected: AudioCollection | null =
    col.collections.find((c) => c.id === selectedId) ?? col.collections[0] ?? null

  const current = player.current
  const currentIsFavorite =
    !!current?.source &&
    col.favoriteKeySet.has(trackKey(current.source.storageBucket, current.source.storagePath))

  if (!user) {
    return (
      <Shell>
        <p className="text-center text-white/60">请先登录后听音频</p>
        <Link href="/auth" className="mt-4 block text-center text-orange-400">
          去登录 →
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="shrink-0 text-white/60 hover:text-white">
          ◀ 首页
        </Link>
        <h1 className="flex-1 text-center text-lg font-bold text-white">🎧 音频</h1>
        <Link
          href="/admin/audio"
          title="媒体管理"
          aria-label="媒体管理"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-400/35 bg-orange-400/10 text-orange-300 transition-colors hover:bg-orange-400/15"
        >
          ⚙
        </Link>
      </header>

      {/* 收藏夹切换：自动换行的紧凑标签，无横向滚动 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {col.collections.map((c) => {
          const isSel = selected?.id === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={clsx(
                'flex items-center gap-1.5 rounded-2xl px-3 py-2 ring-1 transition',
                isSel
                  ? 'bg-orange-400/20 text-orange-100 ring-orange-300/60'
                  : 'bg-white/[0.06] text-white/70 ring-white/10 hover:bg-white/[0.1]',
              )}
            >
              <span className="text-[15px]">{KIND_ICON[c.kind]}</span>
              <span className="text-[13px] font-bold">{c.name}</span>
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                  isSel ? 'bg-orange-300/20 text-orange-100' : 'bg-black/25 text-white/55',
                )}
              >
                {c.tracks.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* 选中收藏夹的操作条：播放整张 / 加入播放列表 */}
      {selected && (
        <div className="mb-4 flex items-center gap-2">
          <span className="min-w-0 truncate text-[15px] font-bold text-white">
            {KIND_ICON[selected.kind]} {selected.name}
          </span>
          <span className="shrink-0 text-[12px] text-white/40">{selected.tracks.length} 首</span>
          <div className="ml-auto flex shrink-0 gap-2">
            <button
              type="button"
              disabled={selected.tracks.length === 0}
              onClick={() => player.play(selected.tracks)}
              className="rounded-full bg-gradient-to-br from-orange-400 to-amber-500 px-3.5 py-2 text-[13px] font-bold text-white shadow-md transition active:scale-95 disabled:opacity-40"
            >
              ▶ 播放全部
            </button>
            <button
              type="button"
              disabled={selected.tracks.length === 0}
              onClick={() => player.enqueue(selected.tracks)}
              className="rounded-full bg-white/10 px-3 py-2 text-[13px] font-bold text-white/85 ring-1 ring-white/15 transition active:scale-95 hover:bg-white/15 disabled:opacity-40"
            >
              ＋ 加入
            </button>
          </div>
        </div>
      )}

      {/* 音频卡片网格 */}
      {col.isLoading ? (
        <p className="py-10 text-center text-white/40">加载中…</p>
      ) : !selected || selected.tracks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
          <div className="mb-2 text-3xl opacity-40">🎵</div>
          <p className="text-white/50">这个收藏夹还没有音频</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 pb-4">
          {selected.tracks.map((track, i) => {
            const src = track.source
            const tk = src ? trackKey(src.storageBucket, src.storagePath) : null
            const inQueue =
              tk !== null &&
              player.queue.some(
                (q) => q.source && trackKey(q.source.storageBucket, q.source.storagePath) === tk,
              )
            const isPlaying =
              tk !== null &&
              !!current?.source &&
              trackKey(current.source.storageBucket, current.source.storagePath) === tk
            const pills = src ? col.membership(src.storageBucket, src.storagePath) : []
            return (
              <li
                key={`${track.url}-${i}`}
                className={clsx(
                  'rounded-2xl p-3.5 ring-1 transition',
                  isPlaying
                    ? 'bg-orange-400/[0.08] ring-orange-300/40'
                    : 'bg-white/[0.06] ring-white/10 hover:bg-white/[0.09]',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-300/15 to-orange-500/[0.04] text-[18px] ring-1 ring-orange-200/15">
                    {track.mediaType === 'video' ? '🎬' : '🎵'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-white">{track.label}</div>
                    {track.refLink && (
                      <Link
                        href={track.refLink}
                        className="text-[11px] text-orange-300/80 hover:text-orange-200"
                      >
                        打开 →
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="播放"
                      title="播放"
                      onClick={() => player.play([track])}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-orange-600 shadow-md ring-1 ring-orange-200/60 transition active:scale-90"
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      aria-label="加入播放列表"
                      title="加入播放列表"
                      onClick={() => player.enqueue([track])}
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-full text-[16px] ring-1 transition active:scale-90',
                        inQueue
                          ? 'bg-orange-400/20 text-orange-300 ring-orange-300/40'
                          : 'bg-white/10 text-white/70 ring-white/15 hover:text-orange-300',
                      )}
                    >
                      {inQueue ? '✓' : '＋'}
                    </button>
                  </div>
                </div>
                {pills.length > 0 && (
                  <div className="mt-2 pl-14">
                    <CollectionPills entries={pills} onRemove={(item) => void col.removeItem(item)} theme="dark" />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <PlayerDock
        player={player}
        theme="dark"
        isFavorite={currentIsFavorite}
        onToggleFavorite={() => {
          if (player.current) void col.toggleFavorite(player.current)
        }}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#100b08]">
      <div className="mx-auto max-w-lg px-4 pt-6 pb-28">{children}</div>
    </div>
  )
}
