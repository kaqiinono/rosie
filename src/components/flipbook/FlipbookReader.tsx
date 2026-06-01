'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { FLIPBOOK_READER_SHELL_CLASS } from '@/components/flipbook/flipbook-reader-shell'
import FlipbookPage from '@/components/flipbook/FlipbookPage'
import FlipbookAudioBar from '@/components/flipbook/FlipbookAudioBar'
import type { FlipbookBook, FlipbookSyncManifest } from '@/utils/flipbook-types'
import {
  audioStartForPage,
  findNextPlayablePage,
  getNarrationEndSec,
  getPlaybackWindow,
  pageForAudioTime,
  shouldSyncFlipFromAudio,
} from '@/utils/flipbook-sync'
import { FLIPBOOK_BASE_PROPS } from '@/utils/flipbook-flip-props'
import { prefetchFlipbookImage, revokeFlipbookImageCache } from '@/utils/flipbook-image-cache'
import {
  flipbookChunkTriggerContainingPage,
  flipbookPagesInChunk,
} from '@/utils/flipbook-page-load'
import { computeFlipbookViewportSize } from '@/utils/flipbook-viewport'

/** Chrome overlays the stage — these are only breathing-room paddings. */
const STAGE_TOP_PAD = 8
const STAGE_BOTTOM_PAD = 8
const STAGE_SIDE_PAD = 6

const HTMLFlipBook = dynamic(() => import('react-pageflip'), { ssr: false })

type PageFlipHandle = {
  pageFlip: () => {
    turnToPage: (page: number) => void
    flipNext: () => void
    flipPrev: () => void
    getCurrentPageIndex: () => number
  }
}

type Orientation = 'portrait' | 'landscape'

type FlipbookReaderProps = {
  book: FlipbookBook
  pageImageUrls: string[]
  audioUrl: string | null
  initialPage?: number
  initialAudioSec?: number
  onProgress?: (lastPage: number, audioPositionSec: number) => void
  backHref?: string
}

export default function FlipbookReader({
  book,
  pageImageUrls,
  audioUrl,
  initialPage = 1,
  initialAudioSec = 0,
  onProgress,
  backHref = '/flipbook',
}: FlipbookReaderProps) {
  const totalPages = pageImageUrls.length
  const stageRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<PageFlipHandle>(null)
  const audioControlRef = useRef<{
    seek: (sec: number) => void
    play: () => void
    pause: () => void
  } | null>(null)
  const lastAudioSecRef = useRef(initialAudioSec ?? 0)
  const loadedTriggersRef = useRef(new Set<number>())
  const syncLock = useRef<'audio' | 'page' | null>(null)

  const resolvedStart = Math.max(1, initialPage ?? 1)
  const [currentPage, setCurrentPage] = useState(resolvedStart)
  const [loadedPages, setLoadedPages] = useState<Record<number, string>>({})
  const [bookSize, setBookSize] = useState<{ width: number; height: number } | null>(null)
  const [autoPlayOnFlip, setAutoPlayOnFlip] = useState(true)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [audioReady, setAudioReady] = useState(!audioUrl)
  const [isMobile, setIsMobile] = useState(false)
  const [orientation, setOrientation] = useState<Orientation>('portrait')

  const manifest: FlipbookSyncManifest | null = book.syncManifest
  const currentCue = manifest?.pages.find((p) => p.page === currentPage) ?? null

  const playbackWindow = useMemo(() => {
    if (!manifest || !currentCue) return null
    return getPlaybackWindow(currentCue, manifest)
  }, [manifest, currentCue])

  const narrEndSec = useMemo(
    () => (manifest ? getNarrationEndSec(manifest) : undefined),
    [manifest],
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const loadPageImage = useCallback(
    async (pageNum: number) => {
      const url = pageImageUrls[pageNum - 1]
      if (!url) return
      const displayUrl = await prefetchFlipbookImage(url)
      setLoadedPages((prev) => (prev[pageNum] ? prev : { ...prev, [pageNum]: displayUrl }))
    },
    [pageImageUrls],
  )

  const ensureChunkLoaded = useCallback(
    async (triggerPage: number, priorityPage?: number) => {
      if (triggerPage < 1 || totalPages === 0) return
      if (loadedTriggersRef.current.has(triggerPage)) return
      loadedTriggersRef.current.add(triggerPage)

      const pageNums = flipbookPagesInChunk(triggerPage, totalPages)
      if (pageNums.length === 0) return

      const ordered =
        priorityPage != null && pageNums.includes(priorityPage)
          ? [priorityPage, ...pageNums.filter((n) => n !== priorityPage)]
          : pageNums

      await loadPageImage(ordered[0])
      if (ordered.length > 1) {
        void Promise.all(ordered.slice(1).map((pageNum) => loadPageImage(pageNum)))
      }
    },
    [loadPageImage, totalPages],
  )

  const ensureChunksForViewing = useCallback(
    async (page: number) => {
      const containing = flipbookChunkTriggerContainingPage(page, totalPages)
      await ensureChunkLoaded(containing, page)
      if (page !== containing) {
        void ensureChunkLoaded(page, page)
      }
    },
    [ensureChunkLoaded, totalPages],
  )

  useEffect(() => {
    if (!totalPages) return
    queueMicrotask(() => {
      void ensureChunksForViewing(resolvedStart)
    })
  }, [resolvedStart, totalPages, ensureChunksForViewing])

  useEffect(() => () => revokeFlipbookImageCache(), [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    let locked = false
    const update = () => {
      // offsetWidth/Height returns layout dims (pre-CSS-transform), which is what
      // we need inside the rotated landscape wrapper. getBoundingClientRect would
      // return the post-rotation visual bbox and mis-size the page.
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (w < 80 || h < 80) return
      const next = computeFlipbookViewportSize(w, h, {
        top: STAGE_TOP_PAD,
        bottom: STAGE_BOTTOM_PAD,
        horizontalPad: STAGE_SIDE_PAD,
      })
      setBookSize((prev) => {
        if (locked && prev) return prev
        locked = true
        return next
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [orientation])

  const flipStartIndex = totalPages > 0 ? Math.min(resolvedStart, totalPages) - 1 : 0

  const turnToPageIndex = useCallback((pageIndexZero: number) => {
    bookRef.current?.pageFlip()?.turnToPage(pageIndexZero)
  }, [])

  const flipNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), [])
  const flipPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), [])

  const reportProgress = useCallback(
    (page: number, audioSec: number) => {
      onProgress?.(page, audioSec)
    },
    [onProgress],
  )

  const handleFlip = useCallback(
    (e: { data: number }) => {
      const page = e.data + 1
      setCurrentPage(page)
      void ensureChunkLoaded(page, page)

      if (syncLock.current === 'audio') {
        syncLock.current = null
        reportProgress(page, lastAudioSecRef.current)
        return
      }
      if (syncLock.current === 'page') {
        syncLock.current = null
        reportProgress(page, lastAudioSecRef.current)
        return
      }

      if (manifest && audioUrl && audioControlRef.current) {
        const cue = manifest.pages.find((p) => p.page === page)
        const win = cue ? getPlaybackWindow(cue, manifest) : null
        if (win?.playable) {
          audioControlRef.current.pause()
          audioControlRef.current.seek(win.start)
          if (autoPlayOnFlip) {
            window.requestAnimationFrame(() => {
              audioControlRef.current?.play()
            })
          }
          reportProgress(page, win.start)
        } else {
          audioControlRef.current.pause()
          reportProgress(page, lastAudioSecRef.current)
        }
      } else {
        reportProgress(page, lastAudioSecRef.current)
      }
    },
    [manifest, audioUrl, reportProgress, autoPlayOnFlip, ensureChunkLoaded],
  )

  const handleAudioTime = useCallback(
    (timeSec: number) => {
      lastAudioSecRef.current = timeSec
      reportProgress(currentPage, timeSec)

      if (!manifest || manifest.mode !== 'auto_turn') return
      const targetPage = pageForAudioTime(manifest, timeSec)
      if (targetPage === currentPage) return
      if (!shouldSyncFlipFromAudio(manifest, targetPage)) return

      syncLock.current = 'audio'
      turnToPageIndex(targetPage - 1)
      setCurrentPage(targetPage)
      void ensureChunkLoaded(targetPage, targetPage)
    },
    [currentPage, manifest, reportProgress, turnToPageIndex, ensureChunkLoaded],
  )

  const handleSegmentEnd = useCallback(() => {
    if (!manifest || !audioUrl || !audioControlRef.current) return
    const next = findNextPlayablePage(manifest, currentPage)
    if (!next) return
    const cue = manifest.pages.find((p) => p.page === next)
    if (!cue) return
    const win = getPlaybackWindow(cue, manifest)
    if (!win.playable) return

    syncLock.current = 'page'
    turnToPageIndex(next - 1)
    setCurrentPage(next)
    void ensureChunkLoaded(next, next)
    audioControlRef.current.pause()
    audioControlRef.current.seek(win.start)
    if (autoPlayOnFlip) {
      window.requestAnimationFrame(() => {
        audioControlRef.current?.play()
      })
    }
    reportProgress(next, win.start)
  }, [
    manifest,
    audioUrl,
    currentPage,
    autoPlayOnFlip,
    reportProgress,
    turnToPageIndex,
    ensureChunkLoaded,
  ])

  const restartFromFirst = useCallback(() => {
    const firstCue = manifest?.pages.find((p) => p.page === 1)
    const firstWin =
      manifest && firstCue ? getPlaybackWindow(firstCue, manifest) : null
    const firstStart = firstWin?.playable
      ? firstWin.start
      : manifest
        ? audioStartForPage(manifest, 1)
        : 0
    turnToPageIndex(0)
    setCurrentPage(1)
    void ensureChunkLoaded(1, 1)
    if (audioControlRef.current) {
      audioControlRef.current.pause()
      audioControlRef.current.seek(firstStart)
      if (firstWin?.playable ?? true) {
        window.requestAnimationFrame(() => audioControlRef.current?.play())
      }
    }
    reportProgress(1, firstStart)
  }, [manifest, reportProgress, turnToPageIndex, ensureChunkLoaded])

  // Keyboard: arrow keys flip, space toggles chrome.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        flipNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        flipPrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        setChromeVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipNext, flipPrev])

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => {
      const next = prev === 'portrait' ? 'landscape' : 'portrait'
      // Best-effort native orientation lock (Android/Chrome in fullscreen).
      const so = (window.screen as Screen & { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation
      try {
        if (next === 'landscape') {
          void document.documentElement.requestFullscreen?.().catch(() => undefined)
          void so?.lock?.('landscape').catch(() => undefined)
        } else {
          so?.unlock?.()
          if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined)
        }
      } catch {
        // Silent fallback to CSS rotation.
      }
      return next
    })
  }, [])

  const durationHintSec = useMemo(() => {
    if (narrEndSec != null) return narrEndSec
    if (!manifest?.pages.length) return undefined
    const last = manifest.pages[manifest.pages.length - 1]
    if (!last) return undefined
    return getPlaybackWindow(last, manifest).end
  }, [manifest, narrEndSec])

  const rotated = isMobile && orientation === 'landscape'

  return (
    <div className={FLIPBOOK_READER_SHELL_CLASS}>
      <div
        className={clsx('flipbook-rotator', rotated && 'flipbook-rotator--landscape')}
      >
        <div className="flipbook-vignette pointer-events-none absolute inset-0" aria-hidden />

        <header
          className={clsx(
            'absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 py-2.5',
            'flipbook-chrome-overlay',
            'transition-all duration-400 ease-out',
            chromeVisible
              ? 'translate-y-0 opacity-100'
              : '-translate-y-full opacity-0 pointer-events-none',
          )}
        >
          <Link
            href={backHref}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--flipbook-fg)] transition hover:bg-[var(--flipbook-control-hover)]"
            aria-label="返回书架"
          >
            <ChevronLeftIcon />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flipbook-title truncate text-[15px] leading-tight text-[var(--flipbook-fg)]">
              {book.title}
            </h1>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--flipbook-muted)]">
              <span className="text-[var(--flipbook-accent)]">{String(currentPage).padStart(2, '0')}</span>
              <span className="mx-1 opacity-40">/</span>
              <span>{String(totalPages).padStart(2, '0')}</span>
            </p>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={toggleOrientation}
              className="flipbook-chip"
              aria-label={orientation === 'portrait' ? '切换到横屏' : '切换到竖屏'}
              title={orientation === 'portrait' ? '横屏阅读' : '竖屏阅读'}
            >
              <RotateIcon rotated={orientation === 'landscape'} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setAutoPlayOnFlip((v) => !v)}
            className={clsx(
              'flipbook-chip',
              autoPlayOnFlip
                ? 'bg-[var(--flipbook-accent)] text-[var(--flipbook-accent-fg)] hover:bg-[var(--flipbook-accent)]'
                : '',
            )}
            aria-pressed={autoPlayOnFlip}
            title="翻页自动播放"
          >
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase">AUTO</span>
          </button>
          <button
            type="button"
            onClick={restartFromFirst}
            className="flipbook-chip"
            title="从第一页开始"
            aria-label="从头开始"
          >
            <RestartIcon />
          </button>
        </header>

        <div
          ref={stageRef}
          className="relative flex min-h-0 flex-1 items-center justify-center"
          onClick={() => setChromeVisible((v) => !v)}
          role="presentation"
        >
          <div
            className="flipbook-stage pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {totalPages > 0 && bookSize ? (
              <HTMLFlipBook
                {...FLIPBOOK_BASE_PROPS}
                ref={bookRef}
                startPage={flipStartIndex}
                width={bookSize.width}
                height={bookSize.height}
                size="fixed"
                minWidth={200}
                maxWidth={2000}
                minHeight={280}
                maxHeight={3000}
                showCover={false}
                usePortrait
                mobileScrollSupport
                onFlip={handleFlip}
                className="flipbook-shadow"
              >
                {pageImageUrls.map((_url, i) => {
                  const pageNum = i + 1
                  return (
                    <FlipbookPage
                      key={`page-${pageNum}`}
                      pageNumber={pageNum}
                      imageUrl={loadedPages[pageNum] ?? null}
                    />
                  )
                })}
              </HTMLFlipBook>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-xs tracking-[0.2em] uppercase text-[var(--flipbook-muted)]">
                <div className="h-7 w-7 animate-spin rounded-full border border-[var(--flipbook-accent)] border-t-transparent" />
                {totalPages > 0 ? 'preparing stage' : 'no pages'}
              </div>
            )}
          </div>

          {/* Edge tap hints — visible briefly, fade after */}
          <div
            className={clsx(
              'flipbook-edge-hint flipbook-edge-hint--left pointer-events-none',
              chromeVisible ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
          <div
            className={clsx(
              'flipbook-edge-hint flipbook-edge-hint--right pointer-events-none',
              chromeVisible ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
        </div>

        {audioUrl ? (
          <div
            className={clsx(
              'absolute inset-x-0 bottom-0 z-20 transition-all duration-400 ease-out',
              'flipbook-chrome-overlay flipbook-chrome-overlay--bottom',
              chromeVisible
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {!audioReady && (
              <p className="px-3 py-1 text-center text-[10px] tracking-[0.18em] uppercase text-[var(--flipbook-muted)]">
                buffering
              </p>
            )}
            <FlipbookAudioBar
              key={audioUrl}
              src={audioUrl}
              initialTimeSec={initialAudioSec ?? 0}
              durationHintSec={durationHintSec}
              segmentStartSec={playbackWindow?.playable ? playbackWindow.start : undefined}
              segmentEndSec={playbackWindow?.playable ? playbackWindow.end : undefined}
              onTimeUpdate={handleAudioTime}
              onSegmentEnd={handleSegmentEnd}
              onReady={() => setAudioReady(true)}
              controlRef={audioControlRef}
            />
          </div>
        ) : null}

        {!chromeVisible && (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 font-mono text-[9px] tracking-[0.22em] uppercase text-white/70 backdrop-blur-md transition hover:text-white"
            onClick={() => setChromeVisible(true)}
          >
            controls
          </button>
        )}
      </div>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RotateIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      style={{ transform: rotated ? 'rotate(90deg)' : 'none', transition: 'transform 250ms ease' }}
    >
      <rect x="6" y="3" width="12" height="18" rx="2" strokeLinejoin="round" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
