'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import { useFlipbookBooks } from '@/hooks/useFlipbookBooks'
import type { FlipbookBook } from '@/utils/flipbook-types'

const LOOP_OPTIONS = [5, 10, 15, 20, 25, 30] as const
type LoopOption = (typeof LOOP_OPTIONS)[number]

export default function FlipbookShelfPage() {
  const { user, loading: authLoading } = useAuth()
  const { setIsImmersive } = useImmersive()
  const { books, isLoading, deleteBook, getSignedAudioUrl } = useFlipbookBooks(user)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingBookId, setPlayingBookId] = useState<string | null>(null)
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null)

  // Playlist / queue state
  const [queueIds, setQueueIds] = useState<string[]>([])
  const [loopLimit, setLoopLimit] = useState<LoopOption>(5)
  const [queueMode, setQueueMode] = useState<'idle' | 'playing'>('idle')
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const queueRef = useRef<FlipbookBook[]>([])
  const loopCountRef = useRef(0)

  const stopShelfAudio = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
    setPlayingBookId(null)
  }, [])

  const stopQueue = useCallback(() => {
    queueRef.current = []
    loopCountRef.current = 0
    setQueueMode('idle')
    setQueueIndex(0)
    stopShelfAudio()
  }, [stopShelfAudio])

  useEffect(() => () => stopQueue(), [stopQueue])

  const playQueueAt = useCallback(
    async (idx: number) => {
      const queue = queueRef.current
      const book = queue[idx]
      if (!book?.audioPath) return
      const el = audioRef.current
      if (!el) return

      setAudioLoadingId(book.id)
      try {
        const url = await getSignedAudioUrl(book.audioPath)
        if (!url) {
          alert('无法加载音频')
          stopQueue()
          return
        }
        el.src = url
        await el.play()
        setQueueIndex(idx)
        setPlayingBookId(book.id)
      } catch {
        alert('音频播放失败')
        stopQueue()
      } finally {
        setAudioLoadingId(null)
      }
    },
    [getSignedAudioUrl, stopQueue],
  )

  const startQueue = useCallback(
    (candidates: FlipbookBook[]) => {
      const queue = candidates.filter((b) => b.audioPath)
      if (!queue.length) return
      queueRef.current = queue
      loopCountRef.current = 0
      setQueueMode('playing')
      void playQueueAt(0)
    },
    [playQueueAt],
  )

  const handleQueueEnded = useCallback(() => {
    if (queueMode !== 'playing') return
    const queue = queueRef.current
    const next = queueIndex + 1
    if (next < queue.length) {
      void playQueueAt(next)
      return
    }
    loopCountRef.current += 1
    if (loopCountRef.current < loopLimit) {
      void playQueueAt(0)
    } else {
      stopQueue()
    }
  }, [queueMode, queueIndex, loopLimit, playQueueAt, stopQueue])

  const handlePlayAudio = useCallback(
    async (book: FlipbookBook) => {
      if (!book.audioPath) return
      const el = audioRef.current
      if (!el) return

      // Single-book play overrides queue mode
      if (queueMode === 'playing') stopQueue()

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
    [getSignedAudioUrl, playingBookId, queueMode, stopQueue, stopShelfAudio],
  )

  const handleDelete = useCallback(
    (book: FlipbookBook) => {
      if (!confirm(`删除「${book.title}」？`)) return

      const inQueue = queueRef.current.findIndex((b) => b.id === book.id)
      if (queueMode === 'playing' && inQueue !== -1) {
        const newQueue = queueRef.current.filter((b) => b.id !== book.id)
        queueRef.current = newQueue
        if (newQueue.length === 0) {
          stopQueue()
        } else if (playingBookId === book.id) {
          const nextIdx = queueIndex >= newQueue.length ? 0 : queueIndex
          void playQueueAt(nextIdx)
        } else if (inQueue < queueIndex) {
          setQueueIndex((i) => i - 1)
        }
      } else if (playingBookId === book.id) {
        stopShelfAudio()
      }

      setQueueIds((prev) => prev.filter((id) => id !== book.id))
      void deleteBook(book)
    },
    [deleteBook, playingBookId, queueMode, queueIndex, playQueueAt, stopQueue, stopShelfAudio],
  )

  const cycleLoopLimit = useCallback(() => {
    setLoopLimit((prev) => {
      const i = LOOP_OPTIONS.indexOf(prev)
      return LOOP_OPTIONS[(i + 1) % LOOP_OPTIONS.length]
    })
  }, [])

  const togglePause = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    if (el.paused) {
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [])

  const goPrev = useCallback(() => {
    const queue = queueRef.current
    if (!queue.length) return
    const prev = (queueIndex - 1 + queue.length) % queue.length
    void playQueueAt(prev)
  }, [queueIndex, playQueueAt])

  const goNext = useCallback(() => {
    const queue = queueRef.current
    if (!queue.length) return
    const next = (queueIndex + 1) % queue.length
    void playQueueAt(next)
  }, [queueIndex, playQueueAt])

  const toggleQueueMember = useCallback((book: FlipbookBook) => {
    setQueueIds((prev) =>
      prev.includes(book.id) ? prev.filter((id) => id !== book.id) : [...prev, book.id],
    )
  }, [])

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

  const audiobooks = books.filter((b) => b.audioPath)
  const selectedAudiobooks = queueIds
    .map((id) => books.find((b) => b.id === id))
    .filter((b): b is FlipbookBook => Boolean(b?.audioPath))
  const hasSelection = selectedAudiobooks.length > 0
  const isQueueActive = queueMode === 'playing'

  const onPrimaryPlayClick = () => {
    if (isQueueActive) {
      stopQueue()
      return
    }
    startQueue(hasSelection ? selectedAudiobooks : audiobooks)
  }

  return (
    <Shell>
      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        loop={queueMode === 'idle'}
        onEnded={handleQueueEnded}
        onPlay={() => setIsPaused(false)}
        onPause={() => setIsPaused(true)}
      />

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

      <div className="mb-4">
        <PlaylistBar
          isPlaying={isQueueActive}
          isPaused={isPaused}
          hasSelection={hasSelection}
          totalAudio={audiobooks.length}
          selectedCount={selectedAudiobooks.length}
          loopLimit={loopLimit}
          onStart={onPrimaryPlayClick}
          onStop={stopQueue}
          onTogglePause={togglePause}
          onPrev={goPrev}
          onNext={goNext}
          onCycleLoop={cycleLoopLimit}
        />
      </div>

      {isLoading ? (
        <p className="text-center text-white/50">加载书架…</p>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
          <p className="text-white/50">还没有书籍</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {books.map((book) => {
            const pos = queueIds.indexOf(book.id)
            return (
              <ShelfBookRow
                key={book.id}
                book={book}
                isPlaying={playingBookId === book.id}
                isAudioLoading={audioLoadingId === book.id}
                queuePosition={pos === -1 ? null : pos + 1}
                onPlayAudio={() => void handlePlayAudio(book)}
                onDelete={() => handleDelete(book)}
                onToggleQueue={() => toggleQueueMember(book)}
                onRead={() => {
                  stopQueue()
                  setIsImmersive(true)
                }}
              />
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

function PlaylistBar({
  isPlaying,
  isPaused,
  hasSelection,
  totalAudio,
  selectedCount,
  loopLimit,
  onStart,
  onStop,
  onTogglePause,
  onPrev,
  onNext,
  onCycleLoop,
}: {
  isPlaying: boolean
  isPaused: boolean
  hasSelection: boolean
  totalAudio: number
  selectedCount: number
  loopLimit: LoopOption
  onStart: () => void
  onStop: () => void
  onTogglePause: () => void
  onPrev: () => void
  onNext: () => void
  onCycleLoop: () => void
}) {
  const disabled = totalAudio === 0
  const live = isPlaying && !isPaused

  return (
    <div
      className={clsx(
        'relative h-12 w-full shrink-0',
        'sm:ml-auto sm:max-w-[19rem] sm:min-w-[14rem]',
        'isolate overflow-hidden rounded-[1.25rem]',
        disabled
          ? 'bg-gradient-to-br from-stone-600 via-stone-700 to-stone-800 ring-1 ring-stone-500/30'
          : 'bg-gradient-to-br from-orange-400 via-amber-500 to-orange-500 ring-1 ring-orange-600/40',
      )}
      style={{
        boxShadow: disabled
          ? '0 4px 12px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.3)'
          : '0 6px 18px -4px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.18)',
        animation: live ? 'var(--animate-player-glow)' : undefined,
      }}
    >
      {/* glossy top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
      />
      {/* "screen" accent strip */}
      <span
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-x-3 top-0 h-px',
          live ? 'bg-white/80' : 'bg-white/40',
        )}
      />

      <div className="relative flex h-full items-center gap-1 px-1.5">
        {isPlaying ? (
          <>
            <Equalizer paused={isPaused} />
            <span aria-hidden className="mx-0.5 h-6 w-px bg-white/25" />
            <GhostButton label="上一本" onClick={onPrev}>
              <PrevIcon />
            </GhostButton>
            <PrimaryDial
              label={isPaused ? '继续播放' : '暂停'}
              onClick={onTogglePause}
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </PrimaryDial>
            <GhostButton label="下一本" onClick={onNext}>
              <NextIcon />
            </GhostButton>
            <span className="min-w-0 flex-1" />
          </>
        ) : (
          <>
            <PrimaryDial
              label={disabled ? '暂无音频' : hasSelection ? '播放选中' : '播放全部'}
              onClick={disabled ? () => {} : onStart}
              disabled={disabled}
            >
              <PlayIcon />
            </PrimaryDial>
            <div className="ml-0.5 min-w-0 flex-1 leading-tight">
              <div
                className={clsx(
                  'font-mono text-[9px] tracking-[0.18em] uppercase',
                  disabled ? 'text-white/55' : 'text-white/75',
                )}
              >
                {disabled
                  ? 'no audio'
                  : hasSelection
                    ? `selected · ${selectedCount}`
                    : `all books · ${totalAudio}`}
              </div>
              <div
                className={clsx(
                  'truncate text-[13px] font-bold leading-tight',
                  disabled ? 'text-white/80' : 'text-white',
                )}
              >
                {disabled
                  ? '上传音频解锁连播'
                  : hasSelection
                    ? '播放选中'
                    : '播放全部'}
              </div>
            </div>
          </>
        )}

        <LoopDial loopLimit={loopLimit} onClick={onCycleLoop} />

        {isPlaying && (
          <button
            type="button"
            onClick={onStop}
            aria-label="停止连播"
            title="停止连播"
            className={clsx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              'bg-black/15 text-white/85 transition active:scale-90',
              'hover:bg-red-500/70 hover:text-white',
            )}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  )
}

function Equalizer({ paused }: { paused: boolean }) {
  const bars = [
    { delay: '0ms' },
    { delay: '180ms' },
    { delay: '90ms' },
    { delay: '260ms' },
  ]
  return (
    <div aria-hidden className="flex h-6 shrink-0 items-end gap-[3px] px-1.5">
      {bars.map((b, i) => (
        <span
          key={i}
          className={clsx(
            'block w-[3px] origin-bottom rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]',
            paused ? 'h-1.5' : 'h-5',
          )}
          style={
            paused
              ? undefined
              : { animation: `var(--animate-eq)`, animationDelay: b.delay }
          }
        />
      ))}
    </div>
  )
}

function PrimaryDial({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        'transition-transform duration-150 active:scale-90',
        'bg-white text-orange-600',
        'shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]',
        'ring-1 ring-orange-200/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="relative drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        {children}
      </span>
    </button>
  )
}

function GhostButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        'text-white/85 transition active:scale-90',
        'hover:bg-white/15 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function LoopDial({
  loopLimit,
  onClick,
}: {
  loopLimit: LoopOption
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`循环 ${loopLimit} 次（点击切换）`}
      aria-label={`循环 ${loopLimit} 次`}
      className={clsx(
        'group flex h-8 shrink-0 items-center gap-1 rounded-full px-2',
        'bg-black/20 text-white transition active:scale-95',
        'ring-1 ring-black/15',
        'hover:bg-black/30',
      )}
    >
      <span className="text-white/80 transition-transform group-active:rotate-180">
        <LoopIcon />
      </span>
      <span className="font-mono text-[12px] font-bold tracking-wide tabular-nums">
        ×{loopLimit}
      </span>
    </button>
  )
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

type ShelfBookRowProps = {
  book: FlipbookBook
  isPlaying: boolean
  isAudioLoading: boolean
  queuePosition: number | null
  onPlayAudio: () => void
  onRead: () => void
  onDelete: () => void
  onToggleQueue: () => void
}

function ShelfBookRow({
  book,
  isPlaying,
  isAudioLoading,
  queuePosition,
  onPlayAudio,
  onRead,
  onDelete,
  onToggleQueue,
}: ShelfBookRowProps) {
  const hasAudio = Boolean(book.audioPath)
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
              hasSync={Boolean(book.syncManifest)}
              isPlaying={isPlaying}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-center pr-1.5">
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
            label={hasAudio ? (isPlaying ? '暂停讲解' : '播放讲解') : '该书暂无音频'}
            disabled={!hasAudio || isAudioLoading}
            active={isPlaying}
            onClick={handleAction(onPlayAudio)}
          >
            {isAudioLoading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
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
  hasSync,
  isPlaying,
}: {
  pageCount: number | null
  hasAudio: boolean
  hasSync: boolean
  isPlaying: boolean
}) {
  const items: { key: string; label: string; tone?: 'accent' | 'live' }[] = []
  items.push({ key: 'pages', label: pageCount != null ? `${pageCount} 页` : '—' })
  if (hasAudio) {
    items.push({
      key: 'audio',
      label: isPlaying ? '播放中' : '有音频',
      tone: isPlaying ? 'live' : undefined,
    })
  }
  if (hasSync) items.push({ key: 'sync', label: '已同步', tone: 'accent' })

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-white/30" />}
          <span
            className={clsx(
              item.tone === 'accent' && 'text-orange-300/80',
              item.tone === 'live' && 'text-orange-300',
            )}
          >
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

function PrevIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="2.5" height="14" rx="0.6" />
      <path d="M19 5.6v12.8a.8.8 0 0 1-1.26.65L8.5 12.65a.8.8 0 0 1 0-1.3l9.24-6.4A.8.8 0 0 1 19 5.6Z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5.6v12.8a.8.8 0 0 0 1.26.65L15.5 12.65a.8.8 0 0 0 0-1.3L6.26 4.95A.8.8 0 0 0 5 5.6Z" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
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

function LoopIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 2.5L20.5 6 17 9.5" />
      <path d="M3.5 11V9a3 3 0 0 1 3-3H20" />
      <path d="M7 21.5L3.5 18 7 14.5" />
      <path d="M20.5 13v2a3 3 0 0 1-3 3H4" />
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

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pt-6 pb-16">{children}</div>
}
