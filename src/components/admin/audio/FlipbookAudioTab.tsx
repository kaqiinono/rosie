'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import { FLIPBOOK_BUCKET, type FlipbookBook } from '@/utils/flipbook-types'
import type { AddPlaylistItemInput, MediaType } from '@/utils/audio-manager-types'

type Props = {
  user: User | null
  onPlay: (url: string, label: string, mediaType: MediaType) => void
  onAddToPlaylist: (input: AddPlaylistItemInput) => void
}

export default function FlipbookAudioTab({ user, onPlay, onAddToPlaylist }: Props) {
  const { books, isLoading, getSignedAudioUrl } = useFlipbookBooks(user)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const booksWithAudio = books.filter(
      (b): b is FlipbookBook & { audioPath: string } => Boolean(b.audioPath),
    )
    void Promise.all(
      booksWithAudio.map(async (b) => {
        const url = await getSignedAudioUrl(b.audioPath)
        if (url) setAudioUrls((prev) => ({ ...prev, [b.id]: url }))
      }),
    )
  }, [books, getSignedAudioUrl])

  const booksWithAudio = books.filter((b) => b.audioPath)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
        <div className="text-[13px] text-slate-400">加载中…</div>
      </div>
    )
  }
  if (booksWithAudio.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="text-3xl opacity-30">📚</div>
        <div className="text-[13px] text-slate-400">还没有绘本上传了音频</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {booksWithAudio.map((b) => {
        const url = audioUrls[b.id]
        return (
          <div
            key={b.id}
            className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 transition-all"
            style={{
              borderLeft: '3px solid #8b5cf6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {/* Icon */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
              style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(124,58,237,0.08))' }}
            >
              📕
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-slate-800">{b.title}</div>
              {b.description && (
                <div className="mt-0.5 truncate text-[11px] text-slate-400">{b.description}</div>
              )}
            </div>

            {/* Actions */}
            {url ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlay(url, b.title, 'audio')}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[13px] text-white transition hover:scale-110"
                  style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', boxShadow: '0 2px 8px rgba(139,92,246,0.35)' }}
                  title="播放"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!b.audioPath) return
                    onAddToPlaylist({
                      itemType: 'flipbook',
                      mediaType: 'audio',
                      label: b.title,
                      storageBucket: FLIPBOOK_BUCKET,
                      storagePath: b.audioPath,
                      refLink: `/flipbook/${b.id}`,
                      assetId: null,
                    })
                  }}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-violet-600 transition hover:bg-violet-50"
                  style={{ border: '1.5px solid rgba(139,92,246,0.3)' }}
                >
                  + 收藏
                </button>
              </div>
            ) : (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-400"
                style={{ background: 'rgba(15,23,42,0.04)' }}
              >
                加载中
              </span>
            )}

            <Link
              href={`/flipbook/${b.id}`}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-violet-400 transition hover:bg-violet-50 hover:text-violet-600"
              title="打开绘本"
            >
              →
            </Link>
          </div>
        )
      })}
    </div>
  )
}
