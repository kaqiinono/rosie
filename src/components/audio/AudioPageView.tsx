'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { User } from '@supabase/supabase-js'
import { useAudioCollections } from '@/hooks/useAudioCollections'
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer'
import PlayerDock from '@/components/audio/PlayerDock'
import CollectionPills from '@/components/audio/CollectionPills'
import { trackKey, type AudioCollection, type AudioCollectionKind } from '@/utils/audio-manager-types'

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

      {/* 收藏夹切换 */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {col.collections.map((c) => {
          const isSel = selected?.id === c.id
          return (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={clsx(
                'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-3 py-2 ring-1 transition',
                isSel
                  ? 'bg-orange-400/15 text-orange-200 ring-orange-300/50'
                  : 'bg-white/[0.06] text-white/70 ring-white/10 hover:bg-white/[0.1]',
              )}
            >
              <span className="text-[15px]">{KIND_ICON[c.kind]}</span>
              <span className="text-[13px] font-bold">{c.name}</span>
              <span className="rounded-full bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                {c.tracks.length}
              </span>
              <button
                type="button"
                aria-label={`播放「${c.name}」`}
                title="播放"
                onClick={(e) => {
                  e.stopPropagation()
                  if (c.tracks.length) player.play(c.tracks)
                }}
                className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] text-white/85 transition hover:bg-orange-400/30"
              >
                ▶
              </button>
              <button
                type="button"
                aria-label={`把「${c.name}」加入播放列表`}
                title="加入播放列表"
                onClick={(e) => {
                  e.stopPropagation()
                  if (c.tracks.length) player.enqueue(c.tracks)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[13px] text-white/85 transition hover:bg-orange-400/30"
              >
                ＋
              </button>
            </div>
          )
        })}
      </div>

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
