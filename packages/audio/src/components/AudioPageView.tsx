'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { User } from '@supabase/supabase-js'
import { useAudioCollections } from '../hooks/useAudioCollections'
import { usePlaylistPlayer } from '@rosie/player'
import { PlayerDock } from '@rosie/player'
import CollectionPills from './CollectionPills'
import { trackKey, type AudioCollection, type AudioCollectionKind } from '@rosie/player'
import { Button, IconButton } from '@rosie/ui/themes'

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
            <Button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              variant={isSel ? 'solid' : 'soft'}
              color={isSel ? 'orange' : 'gray'}
              size="2"
              radius="full"
            >
              <span className="text-[15px]">{KIND_ICON[c.kind]}</span>
              <span>{c.name}</span>
              <span className="font-mono text-[10px] opacity-70">{c.tracks.length}</span>
            </Button>
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
            <Button
              type="button"
              disabled={selected.tracks.length === 0}
              onClick={() => player.play(selected.tracks)}
              variant="solid"
              color="amber"
              size="2"
            >
              ▶ 播放全部
            </Button>
            <Button
              type="button"
              disabled={selected.tracks.length === 0}
              onClick={() => player.enqueue(selected.tracks)}
              variant="outline"
              color="gray"
              size="2"
            >
              ＋ 加入
            </Button>
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
                  <div className="/[0.04] grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-300/15 text-[18px] ring-1 ring-orange-200/15">
                    {track.mediaType === 'video' ? '🎬' : '🎵'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-white">
                      {track.label}
                    </div>
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
                    <IconButton
                      type="button"
                      aria-label="播放"
                      title="播放"
                      onClick={() => player.play([track])}
                      variant="outline"
                      color="orange"
                      size="2"
                      className="w-10"
                    >
                      ▶
                    </IconButton>
                    <IconButton
                      type="button"
                      aria-label="加入播放列表"
                      title="加入播放列表"
                      onClick={() => player.enqueue([track])}
                      variant={inQueue ? 'solid' : 'soft'}
                      color={inQueue ? 'orange' : 'gray'}
                      size="2"
                      className="w-10"
                    >
                      {inQueue ? '✓' : '＋'}
                    </IconButton>
                  </div>
                </div>
                {pills.length > 0 && (
                  <div className="mt-2 pl-14">
                    <CollectionPills
                      entries={pills}
                      onRemove={(item) => void col.removeItem(item)}
                      theme="dark"
                    />
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
