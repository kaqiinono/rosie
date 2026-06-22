'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import FlipbookReader from '@/components/flipbook/FlipbookReader'
import { FLIPBOOK_READER_SHELL_CLASS } from '@/components/flipbook/flipbook-reader-shell'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import { useFlipbookProgress } from '@/hooks/useFlipbookProgress'
import { useFlipbookReaderImmersive } from '@/hooks/useFlipbookReaderImmersive'
import type { FlipbookBook } from '@/utils/flipbook-types'

export default function FlipbookReadPage() {
  useFlipbookReaderImmersive()
  const params = useParams()
  const bookId = typeof params.bookId === 'string' ? params.bookId : ''
  const { user, loading: authLoading } = useAuth()
  const { books, isLoading: booksLoading, getSignedAudioUrl, getSignedPageImageUrls } =
    useFlipbookBooks(user)
  const { progress, isLoading: progressLoading, saveProgress } =
    useFlipbookProgress(user, bookId || null)

  const book: FlipbookBook | undefined = useMemo(
    () => books.find((b) => b.id === bookId),
    [books, bookId],
  )

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [pageImageUrls, setPageImageUrls] = useState<string[] | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)

  useEffect(() => {
    if (!book) return
    let cancelled = false

    void (async () => {
      const [pageImages, audio] = await Promise.all([
        getSignedPageImageUrls(book),
        book.audioPath ? getSignedAudioUrl(book.audioPath) : Promise.resolve(null),
      ])

      if (cancelled) return

      if (pageImages.length === 0) {
        setMediaError('该书暂无页图，请在管理页重新上传')
        return
      }

      setPageImageUrls(pageImages)
      setAudioUrl(audio)
    })()

    return () => {
      cancelled = true
    }
  }, [book, getSignedAudioUrl, getSignedPageImageUrls])

  const handleProgress = useCallback(
    (lastPage: number, audioPositionSec: number) => {
      saveProgress({ lastPage, audioPositionSec })
    },
    [saveProgress],
  )

  if (authLoading || booksLoading) {
    return <ReaderLoading message="加载书籍…" />
  }

  if (!user) {
    return (
      <ReaderMessage>
        <p>请先登录</p>
        <Link href="/auth" className="text-[var(--flipbook-accent)]">
          去登录 →
        </Link>
      </ReaderMessage>
    )
  }

  if (!book) {
    return <ReaderMessage>未找到该书籍</ReaderMessage>
  }

  if (mediaError) {
    return <ReaderMessage className="text-red-300">{mediaError}</ReaderMessage>
  }

  if (!pageImageUrls || progressLoading) {
    return <ReaderLoading message={progressLoading ? '加载进度…' : '加载页图…'} />
  }

  return (
    <FlipbookReader
      key={book.id}
      book={book}
      pageImageUrls={pageImageUrls}
      audioUrl={audioUrl}
      initialPage={progress?.lastPage ?? 1}
      initialAudioSec={progress?.audioPositionSec ?? 0}
      onProgress={handleProgress}
      backHref="/flipbook"
    />
  )
}

function ReaderLoading({ message }: { message: string }) {
  return (
    <div className={clsx(FLIPBOOK_READER_SHELL_CLASS, 'items-center justify-center')}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--flipbook-accent)] border-t-transparent" />
        <p className="text-sm text-[var(--flipbook-muted)]">{message}</p>
      </div>
    </div>
  )
}

function ReaderMessage({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        FLIPBOOK_READER_SHELL_CLASS,
        'items-center justify-center gap-3 px-6 text-center',
      )}
    >
      <Link
        href="/flipbook"
        className="absolute left-4 top-4 text-sm text-[var(--flipbook-muted)] hover:text-[var(--flipbook-fg)]"
      >
        ◀ 书架
      </Link>
      <div className={className ?? 'text-[var(--flipbook-muted)]'}>{children}</div>
    </div>
  )
}
