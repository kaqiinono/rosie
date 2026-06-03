'use client'

import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { useReadingPassageMedia } from '@/hooks/useReadingPassageMedia'
import { readingPassages } from '@/utils/reading-data'
import { READING_AUDIO_BUCKET, readingPassageAudioPath } from '@/utils/reading-audio-types'
import type { AddPlaylistItemInput, MediaType } from '@/utils/audio-manager-types'

type Props = {
  user: User | null
  onPlay: (url: string, label: string, mediaType: MediaType) => void
  onAddToPlaylist: (input: AddPlaylistItemInput) => void
}

export default function ReadingAudioTab({ user, onPlay, onAddToPlaylist }: Props) {
  const { mediaByKey, getUrlForPassage, isLoading } = useReadingPassageMedia(user)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
        <div className="text-[13px] text-slate-400">加载中…</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {readingPassages.map((p) => {
        const url = getUrlForPassage(p.key)
        const hasAudio = Boolean(mediaByKey[p.key])
        return (
          <div
            key={p.key}
            className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 transition-all"
            style={{
              borderLeft: `3px solid ${hasAudio ? '#f43f5e' : 'rgba(15,23,42,0.08)'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
              opacity: hasAudio ? 1 : 0.5,
            }}
          >
            {/* Media icon */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
              style={{
                background: hasAudio
                  ? 'linear-gradient(135deg,rgba(244,63,94,0.15),rgba(225,29,72,0.08))'
                  : 'rgba(15,23,42,0.04)',
              }}
            >
              🎵
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-slate-800">{p.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className="rounded-full px-1.5 py-0.5 font-bold"
                  style={{ background: 'rgba(244,63,94,0.08)', color: '#f43f5e' }}
                >
                  {p.stage}
                </span>
                <span>{p.unit}</span>
                <span>·</span>
                <span>{p.lesson}</span>
              </div>
            </div>

            {/* Actions */}
            {hasAudio && url ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlay(url, p.title, 'audio')}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[13px] text-white transition hover:scale-110"
                  style={{ background: 'linear-gradient(135deg,#f43f5e,#e11d48)', boxShadow: '0 2px 8px rgba(244,63,94,0.35)' }}
                  title="播放"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAddToPlaylist({
                      itemType: 'reading',
                      mediaType: 'audio',
                      label: p.title,
                      storageBucket: READING_AUDIO_BUCKET,
                      storagePath: readingPassageAudioPath(p.key),
                      refLink: `/english/words/reading/${p.key}`,
                      assetId: null,
                    })
                  }
                  className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
                  style={{ border: '1.5px solid rgba(244,63,94,0.3)' }}
                >
                  + 收藏
                </button>
              </div>
            ) : (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-400"
                style={{ background: 'rgba(15,23,42,0.04)' }}
              >
                无音频
              </span>
            )}

            <Link
              href={`/english/words/reading/${p.key}`}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="跳转到文章"
            >
              →
            </Link>
          </div>
        )
      })}
    </div>
  )
}
