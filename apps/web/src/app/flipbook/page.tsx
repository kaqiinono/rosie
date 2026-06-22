'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@rosie/core'
import { useImmersive } from '@rosie/core'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import { useAudioCollections } from '@/hooks/useAudioCollections'
import { usePlaylistPlayer } from '@rosie/player'
import { useWordData } from '@rosie/english'
import { useWordMastery } from '@rosie/english'
import { PlayerDock } from '@rosie/player'
import FlipbookWordCarouselModal, {
  flipbookPreviewWords,
} from '@/components/flipbook/FlipbookWordCarouselModal'
import { trackKey, type PlayerTrack } from '@rosie/player'
import {
  bookHasVocabularyData,
  getBookMatchedWordKeys,
} from '@/utils/flipbook-word-match'
import type { FlipbookBook } from '@/utils/flipbook-types'

export default function FlipbookShelfPage() {
  const { user, loading: authLoading } = useAuth()
  const { setIsImmersive } = useImmersive()
  const { books, isLoading, deleteBook } = useFlipbookBooks(user)
  const { vocab } = useWordData(user)
  const { masteryMap } = useWordMastery(user)
  const col = useAudioCollections(user)
  const player = usePlaylistPlayer()

  const [queueIds, setQueueIds] = useState<string[]>([])
  const [previewBook, setPreviewBook] = useState<FlipbookBook | null>(null)

  const trackByBookId = useMemo(() => {
    const fbCol = col.collections.find((c) => c.kind === 'flipbook')
    const map = new Map<string, PlayerTrack>()
    for (const t of fbCol?.tracks ?? []) {
      const id = t.refLink?.split('/').pop()
      if (id) map.set(id, t)
    }
    return map
  }, [col.collections])

  const previewWords = useMemo(
    () => (previewBook ? flipbookPreviewWords(previewBook, vocab) : []),
    [previewBook, vocab],
  )

  const toggleQueueMember = useCallback((id: string) => {
    setQueueIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleDelete = useCallback(
    (book: FlipbookBook) => {
      if (!confirm(`删除「${book.title}」？`)) return
      const track = trackByBookId.get(book.id)
      if (track && player.current?.refLink === track.refLink) player.stop()
      setQueueIds((prev) => prev.filter((id) => id !== book.id))
      void deleteBook(book)
    },
    [deleteBook, trackByBookId, player],
  )

  const current = player.current
  const currentIsFavorite =
    !!current?.source &&
    col.favoriteKeySet.has(trackKey(current.source.storageBucket, current.source.storagePath))

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

  const audiobookIds = books.filter((b) => b.audioPath).map((b) => b.id)
  const selectedIds = queueIds.filter((id) => audiobookIds.includes(id))
  const hasSelection = selectedIds.length > 0

  const playIds = (ids: string[]) => {
    const tracks = ids
      .map((id) => trackByBookId.get(id))
      .filter((t): t is PlayerTrack => t !== undefined)
    if (tracks.length) player.play(tracks)
  }

  return (
    <Shell>
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="shrink-0 text-white/60 hover:text-white">
          ◀ 首页
        </Link>
        <h1 className="flex-1 text-center text-lg font-bold text-white">绘本阅读</h1>
        <Link
          href="/flipbook/admin"
          title="上传书籍"
          aria-label="上传书籍"
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            'border border-orange-400/35 bg-orange-400/10 text-orange-300',
            'transition-colors hover:bg-orange-400/15',
          )}
        >
          <UploadIcon />
        </Link>
      </header>

      <p className="mb-4 text-xs leading-relaxed text-white/45">
        点书名进入阅读（讲解与翻页并行）；也可在书架只听讲解，或加入连播队列。
      </p>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          disabled={audiobookIds.length === 0}
          onClick={() => playIds(hasSelection ? selectedIds : audiobookIds)}
          className="rounded-full bg-gradient-to-br from-orange-400 to-amber-500 px-4 py-2 text-[13px] font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50"
        >
          ▶{' '}
          {audiobookIds.length === 0
            ? '暂无音频'
            : hasSelection
              ? `播放选中 ${selectedIds.length}`
              : `播放全部 ${audiobookIds.length}`}
        </button>
        {player.queue.length > 0 && (
          <button
            type="button"
            onClick={player.stop}
            className="rounded-full bg-white/10 px-3 py-2 text-[13px] font-bold text-white/85 ring-1 ring-white/15 transition active:scale-95"
          >
            停止
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-center text-white/50">加载书架…</p>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
          <p className="text-white/50">还没有书籍</p>
          <Link
            href="/flipbook/admin"
            className="mt-3 inline-block text-sm text-orange-300 hover:text-orange-200"
          >
            去上传 →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {books.map((book) => {
            const pos = queueIds.indexOf(book.id)
            const track = trackByBookId.get(book.id)
            const isPlaying = !!track && player.current?.refLink === track.refLink
            return (
              <ShelfBookRow
                key={book.id}
                book={book}
                vocabSize={getBookMatchedWordKeys(book.syncManifest, vocab).length}
                isPlaying={isPlaying}
                queuePosition={pos === -1 ? null : pos + 1}
                onPlayAudio={() => track && player.play([track])}
                onDelete={() => handleDelete(book)}
                onToggleQueue={() => toggleQueueMember(book.id)}
                onPreviewWords={() => setPreviewBook(book)}
                onRead={() => {
                  player.stop()
                  setIsImmersive(true)
                }}
              />
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

      {previewBook && (
        <FlipbookWordCarouselModal
          book={previewBook}
          words={previewWords}
          masteryMap={masteryMap}
          onClose={() => setPreviewBook(null)}
        />
      )}
    </Shell>
  )
}

type ShelfBookRowProps = {
  book: FlipbookBook
  vocabSize: number
  isPlaying: boolean
  queuePosition: number | null
  onPlayAudio: () => void
  onRead: () => void
  onDelete: () => void
  onToggleQueue: () => void
  onPreviewWords: () => void
}

function ShelfBookRow({
  book,
  vocabSize,
  isPlaying,
  queuePosition,
  onPlayAudio,
  onRead,
  onDelete,
  onToggleQueue,
  onPreviewWords,
}: ShelfBookRowProps) {
  const hasAudio = Boolean(book.audioPath)
  const hasWords = bookHasVocabularyData(book.syncManifest) && vocabSize > 0
  const inQueue = queuePosition !== null

  const handleAction = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }

  return (
    <li>
      <Link
        href={`/flipbook/${book.id}`}
        onClick={onRead}
        className={clsx(
          'group relative flex items-stretch overflow-hidden rounded-2xl',
          'transition-[transform,background,border-color] duration-200',
          'active:scale-[0.985]',
          isPlaying
            ? 'border border-orange-300/50 bg-orange-400/[0.06] shadow-[0_0_0_1px_rgba(232,165,75,0.18)]'
            : 'border border-white/10 bg-white/[0.06] hover:border-orange-300/30 hover:bg-white/[0.08]',
        )}
      >
        <span
          aria-hidden
          className={clsx(
            'w-1 shrink-0 transition-opacity',
            isPlaying
              ? 'bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500'
              : 'bg-gradient-to-b from-orange-300/70 via-orange-400/50 to-orange-500/20',
          )}
        />

        <div className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-3.5">
          <div
            aria-hidden
            className={clsx(
              'grid h-12 w-12 shrink-0 place-items-center rounded-xl',
              'bg-gradient-to-br from-orange-300/15 to-orange-500/[0.04]',
              'ring-1 ring-orange-200/15 ring-inset',
            )}
          >
            <BookIcon />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] leading-tight font-semibold text-white">
              {book.title}
            </div>
            <MetaRow
              pageCount={book.pageCount ?? null}
              hasAudio={hasAudio}
              wordCount={hasWords ? vocabSize : null}
              isPlaying={isPlaying}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-center pr-1.5">
          {hasWords && (
            <IconButton
              label={`词汇预览（${vocabSize} 词）`}
              onClick={handleAction(onPreviewWords)}
            >
              <WordsIcon />
            </IconButton>
          )}
          {hasAudio && (
            <IconButton
              label={inQueue ? `从队列移除 (#${queuePosition})` : '加入连播队列'}
              active={inQueue}
              badge={queuePosition}
              onClick={handleAction(onToggleQueue)}
            >
              {inQueue ? <CheckIcon /> : <PlusIcon />}
            </IconButton>
          )}
          <IconButton
            label={hasAudio ? (isPlaying ? '播放中' : '播放讲解') : '该书暂无音频'}
            disabled={!hasAudio}
            active={isPlaying}
            onClick={handleAction(onPlayAudio)}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton label="删除书籍" tone="danger" onClick={handleAction(onDelete)}>
            <TrashIcon />
          </IconButton>
        </div>
      </Link>
    </li>
  )
}

function MetaRow({
  pageCount,
  hasAudio,
  wordCount,
  isPlaying,
}: {
  pageCount: number | null
  hasAudio: boolean
  wordCount: number | null
  isPlaying: boolean
}) {
  const items: { key: string; label: string; tone?: 'live' }[] = []
  items.push({ key: 'pages', label: pageCount != null ? `${pageCount} 页` : '—' })
  if (wordCount != null && wordCount > 0) {
    items.push({ key: 'words', label: `${wordCount} 词` })
  }
  if (hasAudio) {
    items.push({
      key: 'audio',
      label: isPlaying ? '播放中' : '有讲解',
      tone: isPlaying ? 'live' : undefined,
    })
  }

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-white/30" />}
          <span className={clsx(item.tone === 'live' && 'text-orange-300')}>
            {item.tone === 'live' && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400 align-middle" />
            )}
            {item.label}
          </span>
        </span>
      ))}
    </div>
  )
}

type IconButtonProps = {
  label: string
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  active?: boolean
  tone?: 'default' | 'danger'
  badge?: number | null
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  active,
  tone = 'default',
  badge,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        'transition-[background,color,transform] duration-150',
        'active:scale-90',
        disabled
          ? 'cursor-not-allowed text-white/20'
          : tone === 'danger'
            ? 'text-white/40 hover:bg-red-500/15 hover:text-red-300'
            : active
              ? 'bg-orange-400/15 text-orange-300 hover:bg-orange-400/25'
              : 'text-white/55 hover:bg-white/10 hover:text-orange-300',
      )}
    >
      {children}
      {badge != null && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 font-mono text-[9px] font-bold text-orange-950 ring-2 ring-[#0a0a0a]"
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function BookIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-orange-200/80"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2V5.5Z" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H20" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.4-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function WordsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H18" />
      <path d="M6 4h11a2 2 0 0 1 2 2v12" />
      <path d="M6 8h8M6 12h6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7l.9 11.2A2 2 0 0 0 9.4 20h5.2a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pt-6 pb-28">{children}</div>
}
