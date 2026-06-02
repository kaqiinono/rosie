'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { useReadingPassageMedia } from '@/hooks/useReadingPassageMedia'
import { useWordsContext } from '@/contexts/WordsContext'
import ReadingAudioButton from '@/components/english/reading/ReadingAudioButton'
import ReadingAudioUploadButton from '@/components/english/reading/ReadingAudioUploadButton'
import { parseFocusLessonKey, readingPassages } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel } from '@/utils/masteryUtils'

const LOOP_OPTIONS = [5, 10, 15, 20, 25, 30] as const
type LoopOption = (typeof LOOP_OPTIONS)[number]

type QueueItem = { key: string; title: string; url: string }

export default function ReadingIndexPage() {
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useWeeklyPlan(user)
  const { vocab, masteryMap } = useWordsContext()
  const { getUrlForPassage, hasAudio, uploadPassageAudio } = useReadingPassageMedia(user)
  const [loopingPassageKey, setLoopingPassageKey] = useState<string | null>(null)

  // Queue state
  const audioRef = useRef<HTMLAudioElement>(null)
  const [queueIds, setQueueIds] = useState<string[]>([])
  const [loopLimit, setLoopLimit] = useState<LoopOption>(5)
  const [queueMode, setQueueMode] = useState<'idle' | 'playing'>('idle')
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const loopCountRef = useRef(0)

  const focusKey = weeklyPlan?.focusLessonKey ?? null
  const parsedFocus = useMemo(
    () => (focusKey ? parseFocusLessonKey(focusKey) : null),
    [focusKey],
  )

  const cards = useMemo(() => {
    return readingPassages.map((p) => {
      const lessonWords = vocab.filter((w) => w.unit === p.unit && w.lesson === p.lesson)
      const mastered = lessonWords.reduce((n, w) => {
        const info = masteryMap[wordKey(w)]
        return n + (info && getWordMasteryLevel(info.correct) >= 3 ? 1 : 0)
      }, 0)
      const isFocus =
        !!parsedFocus &&
        (!parsedFocus.stage || parsedFocus.stage === p.stage) &&
        parsedFocus.unit === p.unit &&
        parsedFocus.lesson === p.lesson
      return {
        passage: p,
        wordCount: lessonWords.length,
        masteredCount: mastered,
        glossaryCount: p.glossary?.length ?? 0,
        paragraphCount: p.paragraphs.length,
        isFocus,
      }
    })
  }, [vocab, masteryMap, parsedFocus])

  const audiobookKeys = useMemo(
    () => readingPassages.filter((p) => hasAudio(p.key)).map((p) => p.key),
    [hasAudio],
  )
  const hasAnyAudio = audiobookKeys.length > 0

  const stopQueue = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
    queueRef.current = []
    loopCountRef.current = 0
    setQueueMode('idle')
    setQueueIndex(0)
    setPlayingKey(null)
  }, [])

  useEffect(() => () => stopQueue(), [stopQueue])

  const playQueueAt = useCallback(
    async (idx: number) => {
      const item = queueRef.current[idx]
      if (!item) return
      const el = audioRef.current
      if (!el) return
      try {
        el.src = item.url
        await el.play()
        setQueueIndex(idx)
        setPlayingKey(item.key)
      } catch {
        stopQueue()
      }
    },
    [stopQueue],
  )

  const startQueue = useCallback(
    (keys: string[]) => {
      const items = keys
        .map((k) => {
          const p = readingPassages.find((x) => x.key === k)
          const url = getUrlForPassage(k)
          if (!p || !url) return null
          return { key: k, title: p.title, url }
        })
        .filter((x): x is QueueItem => x !== null)
      if (!items.length) return

      // Stop any per-card single playback
      setLoopingPassageKey(null)

      queueRef.current = items
      loopCountRef.current = 0
      setQueueMode('playing')
      void playQueueAt(0)
    },
    [getUrlForPassage, playQueueAt],
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
    const len = queueRef.current.length
    if (!len) return
    void playQueueAt((queueIndex - 1 + len) % len)
  }, [queueIndex, playQueueAt])

  const goNext = useCallback(() => {
    const len = queueRef.current.length
    if (!len) return
    void playQueueAt((queueIndex + 1) % len)
  }, [queueIndex, playQueueAt])

  const cycleLoopLimit = useCallback(() => {
    setLoopLimit((prev) => {
      const i = LOOP_OPTIONS.indexOf(prev)
      return LOOP_OPTIONS[(i + 1) % LOOP_OPTIONS.length]
    })
  }, [])

  const toggleQueueMember = useCallback((key: string) => {
    setQueueIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }, [])

  // When user activates a single-card loop, stop the queue
  const handleSingleActivate = useCallback(
    (key: string | null) => {
      if (queueMode === 'playing') stopQueue()
      setLoopingPassageKey(key)
    },
    [queueMode, stopQueue],
  )

  const selectedQueueKeys = queueIds.filter((k) => audiobookKeys.includes(k))
  const hasSelection = selectedQueueKeys.length > 0
  const isQueueActive = queueMode === 'playing'

  const onPrimaryPlayClick = () => {
    if (isQueueActive) {
      stopQueue()
      return
    }
    startQueue(hasSelection ? selectedQueueKeys : audiobookKeys)
  }

  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-3xl px-4 pt-6 pb-32" style={{ colorScheme: 'light' }}>
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        onEnded={handleQueueEnded}
        onPlay={() => setIsPaused(false)}
        onPause={() => setIsPaused(true)}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="font-fredoka shrink-0 text-xl font-bold text-[var(--wm-text)] sm:text-2xl">
          📚 阅读课文
        </h1>
        <PlaylistBar
          isPlaying={isQueueActive}
          isPaused={isPaused}
          hasSelection={hasSelection}
          totalAudio={audiobookKeys.length}
          selectedCount={selectedQueueKeys.length}
          loopLimit={loopLimit}
          onStart={onPrimaryPlayClick}
          onStop={stopQueue}
          onTogglePause={togglePause}
          onPrev={goPrev}
          onNext={goNext}
          onCycleLoop={cycleLoopLimit}
        />
      </div>
      {isLoading && (
        <div className="mb-3 text-[11px] text-[var(--wm-text-dim)]">载入本周计划…</div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200">
          <div className="mb-2 text-4xl">📭</div>
          <div className="font-bold text-gray-800">还没有课文</div>
          <div className="mt-1 text-[12px] text-gray-500">敬请期待新课文上线。</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map(({ passage: p, wordCount, masteredCount, glossaryCount, paragraphCount, isFocus }) => {
            const passageHasAudio = hasAudio(p.key)
            const queuePos = queueIds.indexOf(p.key)
            const inQueue = queuePos !== -1
            const isPlayingInQueue = playingKey === p.key
            return (
              <li
                key={p.key}
                className={clsx(
                  'rounded-2xl bg-white p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,158,11,.18)] sm:p-5',
                  isPlayingInQueue
                    ? 'ring-2 ring-orange-400 shadow-[0_6px_20px_rgba(245,158,11,.25)]'
                    : 'ring-gray-200 hover:ring-orange-300',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/english/words/reading/${p.key}`}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 no-underline ring-1 ring-orange-200 transition hover:bg-orange-100"
                  >
                    📖 {p.unit} · {p.lesson}
                  </Link>
                  {isFocus && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-sky-300">
                      ⭐ 本周精读
                    </span>
                  )}
                  {isPlayingInQueue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-300">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                      连播中
                    </span>
                  )}
                </div>
                <div className="flex items-stretch justify-between gap-3">
                  <Link
                    href={`/english/words/reading/${p.key}`}
                    className="group min-w-0 flex-1 no-underline"
                  >
                    <h2 className="font-fredoka text-lg font-bold text-gray-900 group-hover:text-orange-700 sm:text-xl">
                      {p.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-600">
                      <span>📄 {paragraphCount} 段</span>
                      {wordCount > 0 && (
                        <span>
                          📝 本课词 <span className="font-bold text-emerald-700">{masteredCount}</span>
                          <span className="text-gray-400"> / {wordCount} 已掌握</span>
                        </span>
                      )}
                      {glossaryCount > 0 && <span>📒 {glossaryCount} 难点词</span>}
                    </div>
                  </Link>
                  <div
                    className={clsx(
                      'relative flex shrink-0 flex-col items-end justify-between gap-1.5 self-stretch py-0.5 pl-3',
                      'before:absolute before:inset-y-1 before:left-0 before:w-px',
                      'before:bg-gradient-to-b before:from-transparent before:via-orange-200/70 before:to-transparent',
                      'sm:flex-row sm:items-center sm:justify-end sm:self-auto sm:py-0 sm:pl-0',
                      'sm:before:hidden',
                    )}
                  >
                    {passageHasAudio && (
                      <QueueToggleButton
                        active={inQueue}
                        position={inQueue ? queuePos + 1 : null}
                        onClick={() => toggleQueueMember(p.key)}
                      />
                    )}
                    <ReadingAudioUploadButton
                      passageKey={p.key}
                      hasAudio={hasAudio(p.key)}
                      onUpload={uploadPassageAudio}
                      size="sm"
                    />
                    <ReadingAudioButton
                      src={getUrlForPassage(p.key)}
                      mode="loop"
                      passageKey={p.key}
                      activeKey={loopingPassageKey}
                      onActivate={handleSingleActivate}
                      size="sm"
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
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
        'rounded-[1.25rem] overflow-hidden isolate',
        disabled
          ? 'bg-gradient-to-br from-stone-300 via-stone-400 to-stone-500 ring-1 ring-stone-500/40'
          : 'bg-gradient-to-br from-orange-400 via-amber-500 to-orange-500 ring-1 ring-orange-600/40',
      )}
      style={{
        boxShadow: disabled
          ? '0 4px 12px -4px rgba(120,113,108,0.4), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.15)'
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
            <GhostButton label="上一篇" onClick={onPrev}>
              <PrevIcon />
            </GhostButton>
            <PrimaryDial
              label={isPaused ? '继续播放' : '暂停'}
              onClick={onTogglePause}
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </PrimaryDial>
            <GhostButton label="下一篇" onClick={onNext}>
              <NextIcon />
            </GhostButton>
            <span className="flex-1 min-w-0" />
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
                  disabled ? 'text-stone-100/80' : 'text-white/75',
                )}
              >
                {disabled
                  ? 'no audio'
                  : hasSelection
                    ? `selected · ${selectedCount}`
                    : `all tracks · ${totalAudio}`}
              </div>
              <div
                className={clsx(
                  'font-fredoka truncate text-[13px] font-bold leading-tight',
                  disabled ? 'text-white/90' : 'text-white',
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
    <div
      aria-hidden
      className="flex h-6 shrink-0 items-end gap-[3px] px-1.5"
    >
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
      <span className="font-mono text-[12px] font-bold tabular-nums tracking-wide">
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

function QueueToggleButton({
  active,
  position,
  onClick,
}: {
  active: boolean
  position: number | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-label={active ? `从队列移除 (#${position})` : '加入连播队列'}
      title={active ? `从队列移除 (#${position})` : '加入连播队列'}
      className={clsx(
        'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] ring-1 transition active:scale-95',
        active
          ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white ring-orange-300 shadow-sm'
          : 'bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
      )}
    >
      {active ? <CheckIcon /> : <PlusIcon />}
      {active && position != null && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 font-mono text-[9px] font-bold text-white ring-2 ring-white"
        >
          {position}
        </span>
      )}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.4-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="2.5" height="14" rx="0.6" />
      <path d="M19 5.6v12.8a.8.8 0 0 1-1.26.65L8.5 12.65a.8.8 0 0 1 0-1.3l9.24-6.4A.8.8 0 0 1 19 5.6Z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5.6v12.8a.8.8 0 0 0 1.26.65L15.5 12.65a.8.8 0 0 0 0-1.3L6.26 4.95A.8.8 0 0 0 5 5.6Z" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg
      width="14"
      height="14"
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
