'use client'

import Link from 'next/link'
import clsx from 'clsx'
import type { AudioCollection, AudioPlaylistItem, PlayerTrack } from '@/utils/audio-manager-types'

type Props = {
  collection: AudioCollection
  /** 当前正在播放曲目的 'bucket|path' 键，用于高亮。 */
  currentKey: string | null
  onPlayTrack: (track: PlayerTrack) => void
  onPlayAll: () => void
  onEnqueueAll: () => void
  /** 解析某曲目在本收藏夹里的 item（虚拟收藏夹返回 null，不可移除）。 */
  getItem: (track: PlayerTrack) => AudioPlaylistItem | null
  onRemove: (item: AudioPlaylistItem) => void
}

export default function CollectionView({
  collection,
  currentKey,
  onPlayTrack,
  onPlayAll,
  onEnqueueAll,
  getItem,
  onRemove,
}: Props) {
  const empty = collection.tracks.length === 0

  return (
    <div className="space-y-3">
      {/* 头部操作条 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold text-slate-800">{collection.name}</div>
          <div className="text-[11px] text-slate-400">{collection.tracks.length} 首</div>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            disabled={empty}
            onClick={onPlayAll}
            className="rounded-full px-3.5 py-2 text-[12px] font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
          >
            ▶ 播放全部
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onEnqueueAll}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-extrabold text-amber-700 transition active:scale-95 disabled:opacity-40"
          >
            ＋ 加入队列
          </button>
        </div>
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="text-4xl opacity-25">🎵</div>
          <div className="text-[13px] text-slate-400">这个收藏夹还没有音频</div>
          {collection.acceptsItems && (
            <div className="text-[11px] text-slate-300">去「独立媒体库」把音频加入这里</div>
          )}
        </div>
      ) : (
        collection.tracks.map((track, i) => {
          const item = getItem(track)
          const tk = track.source
            ? `${track.source.storageBucket}|${track.source.storagePath}`
            : null
          const isPlaying = tk !== null && tk === currentKey
          return (
            <div
              key={`${track.url}-${i}`}
              className={clsx(
                'flex items-center gap-3 rounded-2xl bg-white px-4 py-3 transition-all hover:shadow-md',
                isPlaying ? 'ring-2 ring-amber-300' : 'ring-1 ring-slate-100',
              )}
              style={{ borderLeft: `3px solid ${isPlaying ? '#f59e0b' : '#fbbf24'}` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-[15px]">
                {track.mediaType === 'video' ? '🎬' : '🎵'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-slate-800">{track.label}</div>
                {track.refLink && (
                  <Link href={track.refLink} className="text-[11px] text-amber-600 hover:text-amber-800">
                    打开 →
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => onPlayTrack(track)}
                title="播放"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] text-white transition hover:scale-110"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
              >
                ▶
              </button>
              {item && (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  title="从该收藏夹移除"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-1 text-[12px] text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
