'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LOOP_COUNTS,
  trackKey,
  type LoopCount,
  type LoopMode,
  type PlayerTrack,
} from '@/utils/audio-manager-types'

export interface PlaylistPlayer {
  audioRef: React.RefObject<HTMLAudioElement | null>
  queue: PlayerTrack[]
  index: number
  current: PlayerTrack | null
  isPlaying: boolean
  isPaused: boolean
  loopMode: LoopMode
  loopCount: LoopCount
  play: (tracks: PlayerTrack[], startIndex?: number) => void
  enqueue: (tracks: PlayerTrack[]) => void
  togglePause: () => void
  prev: () => void
  next: () => void
  jumpTo: (i: number) => void
  setLoopMode: (m: LoopMode) => void
  cycleLoopMode: () => void
  cycleLoopCount: () => void
  stop: () => void
  onEnded: () => void
  notifyPlay: () => void
  notifyPause: () => void
}

const LOOP_MODE_NEXT: Record<LoopMode, LoopMode> = { order: 'one', one: 'all', all: 'order' }

/** 去重键：优先用 source 的 bucket|path，缺失时退化用 url。 */
function dedupeKey(t: PlayerTrack): string {
  if (t.source) return trackKey(t.source.storageBucket, t.source.storagePath)
  return t.url
}

export function usePlaylistPlayer(): PlaylistPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [loopMode, setLoopModeState] = useState<LoopMode>('order')
  const [loopCount, setLoopCount] = useState<LoopCount>(5)
  const loopsDoneRef = useRef(0)

  const queueRef = useRef<PlayerTrack[]>([])
  queueRef.current = queue

  const playAt = useCallback((tracks: PlayerTrack[], i: number) => {
    const el = audioRef.current
    const track = tracks[i]
    if (!el || !track) return
    el.src = track.url
    void el.play().catch(() => setIsPlaying(false))
    setIndex(i)
    setIsPlaying(true)
    setIsPaused(false)
  }, [])

  const play = useCallback(
    (tracks: PlayerTrack[], startIndex = 0) => {
      if (tracks.length === 0) return
      loopsDoneRef.current = 0
      setQueue(tracks)
      queueRef.current = tracks
      playAt(tracks, startIndex)
    },
    [playAt],
  )

  const enqueue = useCallback(
    (tracks: PlayerTrack[]) => {
      const existing = queueRef.current
      const seen = new Set(existing.map(dedupeKey))
      const additions: PlayerTrack[] = []
      for (const t of tracks) {
        const k = dedupeKey(t)
        if (seen.has(k)) continue
        seen.add(k)
        additions.push(t)
      }
      if (additions.length === 0) return
      const merged = [...existing, ...additions]
      setQueue(merged)
      queueRef.current = merged
      if (existing.length === 0) playAt(merged, 0)
    },
    [playAt],
  )

  const stop = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
    }
    loopsDoneRef.current = 0
    setQueue([])
    queueRef.current = []
    setIndex(0)
    setIsPlaying(false)
    setIsPaused(false)
  }, [])

  const togglePause = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()
  }, [])

  const jumpTo = useCallback(
    (i: number) => {
      const q = queueRef.current
      if (i < 0 || i >= q.length) return
      loopsDoneRef.current = 0
      playAt(q, i)
    },
    [playAt],
  )

  const prev = useCallback(() => {
    const len = queueRef.current.length
    if (!len) return
    loopsDoneRef.current = 0
    playAt(queueRef.current, (index - 1 + len) % len)
  }, [index, playAt])

  const next = useCallback(() => {
    const len = queueRef.current.length
    if (!len) return
    loopsDoneRef.current = 0
    playAt(queueRef.current, (index + 1) % len)
  }, [index, playAt])

  const setLoopMode = useCallback((m: LoopMode) => setLoopModeState(m), [])
  const cycleLoopMode = useCallback(() => setLoopModeState((m) => LOOP_MODE_NEXT[m]), [])
  const cycleLoopCount = useCallback(() => {
    setLoopCount((prev) => {
      const i = LOOP_COUNTS.indexOf(prev)
      return LOOP_COUNTS[(i + 1) % LOOP_COUNTS.length]
    })
  }, [])

  const onEnded = useCallback(() => {
    const q = queueRef.current
    if (q.length === 0) return
    if (loopMode === 'one') {
      loopsDoneRef.current += 1
      if (loopsDoneRef.current < loopCount) {
        const el = audioRef.current
        if (el) {
          el.currentTime = 0
          void el.play().catch(() => {})
        }
      } else stop()
      return
    }
    if (loopMode === 'all') {
      if (index < q.length - 1) {
        playAt(q, index + 1)
        return
      }
      loopsDoneRef.current += 1
      if (loopsDoneRef.current < loopCount) playAt(q, 0)
      else stop()
      return
    }
    // order
    if (index < q.length - 1) playAt(q, index + 1)
    else setIsPlaying(false)
  }, [loopMode, loopCount, index, playAt, stop])

  const notifyPlay = useCallback(() => setIsPaused(false), [])
  const notifyPause = useCallback(() => setIsPaused(true), [])

  // 卸载即停
  useEffect(
    () => () => {
      const el = audioRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
      }
    },
    [],
  )

  return {
    audioRef,
    queue,
    index,
    current: queue[index] ?? null,
    isPlaying,
    isPaused,
    loopMode,
    loopCount,
    play,
    enqueue,
    togglePause,
    prev,
    next,
    jumpTo,
    setLoopMode,
    cycleLoopMode,
    cycleLoopCount,
    stop,
    onEnded,
    notifyPlay,
    notifyPause,
  }
}
