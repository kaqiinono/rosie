'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import type { FlipbookBook } from '@/utils/flipbook-types'

export default function FlipbookShelfPage() {
  const { user, loading: authLoading } = useAuth()
  const { setIsImmersive } = useImmersive()
  const { books, isLoading, deleteBook, getSignedAudioUrl } = useFlipbookBooks(user)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingBookId, setPlayingBookId] = useState<string | null>(null)
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null)

  const stopShelfAudio = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
    setPlayingBookId(null)
  }, [])

  useEffect(() => () => stopShelfAudio(), [stopShelfAudio])

  const handlePlayAudio = useCallback(
    async (book: FlipbookBook) => {
      if (!book.audioPath) return
      const el = audioRef.current
      if (!el) return

      if (playingBookId === book.id && !el.paused) {
        stopShelfAudio()
        return
      }

      setAudioLoadingId(book.id)
      try {
        const url = await getSignedAudioUrl(book.audioPath)
        if (!url) {
          alert('无法加载音频')
          return
        }
        el.src = url
        await el.play()
        setPlayingBookId(book.id)
      } catch {
        alert('音频播放失败')
        stopShelfAudio()
      } finally {
        setAudioLoadingId(null)
      }
    },
    [getSignedAudioUrl, playingBookId, stopShelfAudio],
  )

  const handleDelete = useCallback(
    (book: FlipbookBook) => {
      if (!confirm(`删除「${book.title}」？`)) return
      if (playingBookId === book.id) stopShelfAudio()
      void deleteBook(book)
    },
    [deleteBook, playingBookId, stopShelfAudio],
  )

  if (authLoading) {
    return <Shell>加载中…</Shell>
  }

  if (!user) {
    return (
      <Shell>
        <p className="text-center text-white/60">请先登录后使用绘本阅读</p>
        <Link href="/auth" className="mt-4 block text-center text-orange-400">
          去登录 →
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        onEnded={() => setPlayingBookId(null)}
      />

      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="shrink-0 text-white/60 hover:text-white">
          ◀ 首页
        </Link>
        <h1 className="flex-1 text-center text-lg font-bold text-white">绘本阅读</h1>
        <span className="w-12 shrink-0" aria-hidden />
      </header>

      <p className="mb-4 text-sm text-white/50">
        3D 翻页讲义，支持讲解音频与页码同步（需上传 sync.json）。
      </p>

      <Link
        href="/flipbook/admin"
        className="mb-6 flex w-full items-center justify-center rounded-2xl border border-orange-400/35 bg-orange-400/10 py-3 text-sm font-semibold text-orange-300 transition-colors hover:bg-orange-400/15"
      >
        上传书籍
      </Link>

      {isLoading ? (
        <p className="text-center text-white/50">加载书架…</p>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
          <p className="text-white/50">还没有书籍</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {books.map((book) => (
            <ShelfBookRow
              key={book.id}
              book={book}
              isPlaying={playingBookId === book.id}
              isAudioLoading={audioLoadingId === book.id}
              onPlayAudio={() => void handlePlayAudio(book)}
              onDelete={() => handleDelete(book)}
              onRead={() => {
                stopShelfAudio()
                setIsImmersive(true)
              }}
            />
          ))}
        </ul>
      )}
    </Shell>
  )
}

type ShelfBookRowProps = {
  book: FlipbookBook
  isPlaying: boolean
  isAudioLoading: boolean
  onPlayAudio: () => void
  onRead: () => void
  onDelete: () => void
}

function ShelfBookRow({
  book,
  isPlaying,
  isAudioLoading,
  onPlayAudio,
  onRead,
  onDelete,
}: ShelfBookRowProps) {
  const hasAudio = Boolean(book.audioPath)

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{book.title}</div>
        <div className="mt-1 text-xs text-white/45">
          {book.pageCount != null ? `${book.pageCount} 页` : '—'}
          {book.audioPath ? ' · 有音频' : ''}
          {book.syncManifest ? ' · 已同步' : ''}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          title={hasAudio ? (isPlaying ? '暂停讲解' : '播放讲解') : '该书暂无音频'}
          disabled={!hasAudio || isAudioLoading}
          onClick={onPlayAudio}
          className={clsx(
            'shrink-0 text-xs font-medium',
            hasAudio && !isAudioLoading
              ? isPlaying
                ? 'text-orange-300 hover:text-orange-200'
                : 'text-white/50 hover:text-orange-300'
              : 'cursor-not-allowed text-white/20',
          )}
        >
          {isAudioLoading ? '…' : isPlaying ? '暂停' : '音频'}
        </button>

        <Link
          href={`/flipbook/${book.id}`}
          onClick={onRead}
          className="shrink-0 text-xs font-medium text-white/50 hover:text-orange-300"
        >
          阅读
        </Link>

        <button
          type="button"
          className="shrink-0 text-xs text-white/30 hover:text-red-300"
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </li>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pb-16 pt-6">{children}</div>
}
