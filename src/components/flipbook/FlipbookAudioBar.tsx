'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const RATES = [0.75, 1, 1.25] as const
const UI_TICK_MS = 200
const PROGRESS_REPORT_MS = 2500

type FlipbookAudioBarProps = {
  src: string
  initialTimeSec: number
  durationHintSec?: number
  segmentStartSec?: number
  segmentEndSec?: number
  onTimeUpdate: (timeSec: number) => void
  onPlayStateChange?: (playing: boolean) => void
  /** 当前页口播区间播完（到达 segmentEnd） */
  onSegmentEnd?: () => void
  onReady?: () => void
  controlRef?: React.MutableRefObject<
    | {
        seek: (sec: number) => void
        play: () => void
        pause: () => void
      }
    | null
  >
}

export default function FlipbookAudioBar({
  src,
  initialTimeSec,
  durationHintSec,
  segmentStartSec,
  segmentEndSec,
  onTimeUpdate,
  onPlayStateChange,
  onSegmentEnd,
  onReady,
  controlRef,
}: FlipbookAudioBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onSegmentEndRef = useRef(onSegmentEnd)
  const segmentEndRef = useRef(segmentEndSec)
  const segmentStartRef = useRef(segmentStartSec)
  const segmentEndedRef = useRef(false)
  const lastReportedRef = useRef(0)
  const initialApplied = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(durationHintSec ?? 0)
  const [rateIdx, setRateIdx] = useState(1)

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])

  useEffect(() => {
    onSegmentEndRef.current = onSegmentEnd
  }, [onSegmentEnd])

  useEffect(() => {
    segmentEndRef.current = segmentEndSec
    segmentStartRef.current = segmentStartSec
    segmentEndedRef.current = false
  }, [segmentStartSec, segmentEndSec])

  const reportProgress = useCallback((sec: number, force = false) => {
    const now = Date.now()
    if (!force && now - lastReportedRef.current < PROGRESS_REPORT_MS) return
    lastReportedRef.current = now
    onTimeUpdateRef.current(sec)
  }, [])

  const seekTo = useCallback(
    (sec: number, options?: { report?: boolean }) => {
      const el = audioRef.current
      if (!el) return
      const t = Math.max(0, sec)
      segmentEndedRef.current = false
      el.currentTime = t
      setCurrent(t)
      if (options?.report !== false) reportProgress(t, true)
    },
    [reportProgress],
  )

  const ensureInSegment = useCallback(() => {
    const el = audioRef.current
    const start = segmentStartRef.current
    const end = segmentEndRef.current
    if (!el || start == null || end == null) return
    if (el.currentTime < start - 0.02 || el.currentTime >= end - 0.02) {
      seekTo(start, { report: false })
    }
  }, [seekTo])

  useEffect(() => {
    if (!controlRef) return
    controlRef.current = {
      seek: (sec) => seekTo(sec, { report: true }),
      play: () => {
        const el = audioRef.current
        if (!el) return
        segmentEndedRef.current = false
        ensureInSegment()
        void el.play().catch(() => {})
      },
      pause: () => {
        audioRef.current?.pause()
      },
    }
    return () => {
      controlRef.current = null
    }
  }, [controlRef, seekTo, ensureInSegment])

  useEffect(() => {
    const el = audioRef.current
    if (!el || initialApplied.current) return

    const applyInitial = () => {
      if (initialTimeSec > 0 && Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = Math.min(initialTimeSec, el.duration - 0.05)
        setCurrent(el.currentTime)
        reportProgress(el.currentTime, true)
      }
      initialApplied.current = true
    }

    if (el.readyState >= 1) applyInitial()
    else el.addEventListener('loadedmetadata', applyInitial, { once: true })
  }, [src, initialTimeSec, reportProgress])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.playbackRate = RATES[rateIdx]
  }, [rateIdx])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !playing) return

    const tick = () => {
      const end = segmentEndRef.current
      if (end != null && el.currentTime >= end - 0.08) {
        if (!segmentEndedRef.current) {
          segmentEndedRef.current = true
          el.pause()
          setPlaying(false)
          setCurrent(end)
          reportProgress(end, true)
          onSegmentEndRef.current?.()
        }
        return
      }
      setCurrent(el.currentTime)
      reportProgress(el.currentTime)
    }

    tick()
    const id = window.setInterval(tick, UI_TICK_MS)
    return () => clearInterval(id)
  }, [playing, reportProgress])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el || !ready) return
    if (el.paused) {
      segmentEndedRef.current = false
      ensureInSegment()
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }

  const onSeekInput = (value: number) => {
    segmentEndedRef.current = false
    seekTo(value, { report: true })
  }

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const sliderMin = segmentStartSec ?? 0
  const sliderMax =
    segmentEndSec ?? durationHintSec ?? duration ?? Math.max(current, sliderMin + 1)
  const maxDuration =
    sliderMax > sliderMin ? sliderMax : Math.max(current, sliderMin + 1)

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2',
        'border-t border-[var(--flipbook-chrome-border)] bg-[var(--flipbook-chrome-bg)]',
        'backdrop-blur-xl',
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        className="hidden"
        aria-hidden
        onLoadedMetadata={() => {
          const el = audioRef.current
          if (el?.duration && Number.isFinite(el.duration)) {
            setDuration(el.duration)
          }
          setReady(true)
          onReady?.()
        }}
        onCanPlayThrough={() => {
          setReady(true)
          onReady?.()
        }}
        onPlaying={() => {
          setPlaying(true)
          onPlayStateChange?.(true)
        }}
        onPause={() => {
          setPlaying(false)
          onPlayStateChange?.(false)
        }}
        onEnded={() => {
          setPlaying(false)
          onPlayStateChange?.(false)
        }}
        onError={() => setReady(false)}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        className={clsx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          'bg-[var(--flipbook-accent)] text-[var(--flipbook-accent-fg)] shadow-md',
          'transition-transform active:scale-95',
          'disabled:opacity-40 disabled:active:scale-100',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[var(--flipbook-accent)]',
        )}
        aria-label={playing ? '暂停' : '播放'}
      >
        {!ready ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : playing ? (
          <PauseIcon />
        ) : (
          <PlayIcon />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={sliderMin}
          max={maxDuration}
          step={0.1}
          value={Math.min(current, maxDuration)}
          disabled={!ready}
          onChange={(e) => onSeekInput(Number(e.target.value))}
          className="flipbook-range h-1.5 w-full cursor-pointer disabled:opacity-40"
          aria-label="播放进度"
        />
        <div className="mt-0.5 flex justify-between font-mono text-[10px] tracking-wide text-[var(--flipbook-muted)]">
          <span>{fmt(current)}</span>
          <span>{fmt(duration > 0 ? duration : maxDuration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRateIdx((i) => (i + 1) % RATES.length)}
        disabled={!ready}
        className={clsx(
          'shrink-0 rounded-md px-2 py-1.5 font-mono text-xs font-semibold',
          'text-[var(--flipbook-fg)] bg-[var(--flipbook-control-bg)]',
          'hover:bg-[var(--flipbook-control-hover)]',
          'disabled:opacity-40',
          'min-w-[44px] min-h-[44px]',
        )}
        aria-label="切换播放速度"
      >
        {RATES[rateIdx]}×
      </button>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  )
}
