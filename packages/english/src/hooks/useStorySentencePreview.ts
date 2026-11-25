'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaybackProgram, type PlaybackProgramStep } from '@rosie/player'
import { readStoryCues } from '../utils/story-timing'

type Bounds = { startMs: number; endMs: number }
type Source = { src: string; timeline: string }
type LocatedCue = Bounds & { id: string; src: string }
type Timings = { sources: readonly Source[]; cues: Map<string, LocatedCue[]>; failed: boolean }
type PlaybackRange = { timings: Timings; cues: LocatedCue[] }

export function useStorySentencePreview(sources: readonly Source[] | undefined) {
  const [timings, setTimings] = useState<Timings | null>(null)
  const [range, setRange] = useState<PlaybackRange | null>(null)
  const [activeCue, setActiveCue] = useState<{ id: string; timings: Timings } | null>(null)
  const [playbackError, setPlaybackError] = useState('')
  const attempt = useRef(0)
  const running = useRef(false)
  const fail = useCallback(() => {
    running.current = false
    setRange(null)
    setPlaybackError('试听未能完成，请重试。')
  }, [])
  const complete = useCallback(() => {
    running.current = false
    setRange(null)
  }, [])
  const { audioRef, start, dispose } = usePlaybackProgram(fail, complete, { reuseLoadedSource: true })

  useEffect(() => {
    if (!sources?.length) return
    const controller = new AbortController()
    void (async () => {
      const tracks = await Promise.allSettled(sources.map(async source => {
        const response = await fetch(source.timeline, { signal: controller.signal, cache: 'no-store' })
        if (response.status === 404) return []
        if (!response.ok) throw new Error('Story timing unavailable')
        return Array.from(readStoryCues(await response.text()), ([id, bounds]) => ({ ...bounds, id, src: source.src }))
      }))
      if (controller.signal.aborted) return
      const cues = new Map<string, LocatedCue[]>()
      for (const track of tracks) {
        if (track.status !== 'fulfilled') continue
        for (const cue of track.value) {
          const fragments = cues.get(cue.id)
          if (fragments) fragments.push(cue)
          else cues.set(cue.id, [cue])
        }
      }
      setTimings({ sources, cues, failed: tracks.some(track => track.status === 'rejected') })
    })()
    return () => controller.abort()
  }, [sources])

  useEffect(() => () => {
    attempt.current += 1
    running.current = false
    dispose()
  }, [sources, dispose])

  const stop = useCallback(() => {
    attempt.current += 1
    if (running.current) dispose()
    running.current = false
    setRange(null)
    setActiveCue(null)
    setPlaybackError('')
  }, [dispose])

  const current = timings && timings.sources === sources ? timings : null
  const playing = range !== null && range.timings === current
  const activeId = activeCue?.timings === current ? activeCue?.id ?? null : null

  const preload = useCallback((id: string | undefined) => {
    const media = audioRef.current
    const cue = id ? current?.cues.get(id)?.[0] : undefined
    if (!media || !cue || playing || running.current) return

    if (media.getAttribute('src') !== cue.src) media.src = cue.src
    const seek = () => {
      const start = cue.startMs / 1000
      if (!running.current && media.getAttribute('src') === cue.src && Math.abs(media.currentTime - start) > 0.01) {
        media.currentTime = start
      }
    }
    if (media.readyState >= 1) seek()
    else media.addEventListener('loadedmetadata', seek, { once: true })
    return () => media.removeEventListener('loadedmetadata', seek)
  }, [audioRef, current, playing])

  function syncPlayback() {
    const media = audioRef.current
    if (!playing || !range || range.cues.length < 2 || !media || media.seeking) return
    const positionMs = media.currentTime * 1000
    const src = media.getAttribute('src')
    const cue = range.cues.find(cue => cue.src === src && positionMs >= cue.startMs && positionMs < cue.endMs)
    if (cue && cue.id !== activeId) setActiveCue({ id: cue.id, timings: range.timings })
  }

  async function play(sentenceIds: readonly string[]) {
    if (!current) return
    const cues = sentenceIds.flatMap(id => current.cues.get(id) ?? [])
    const first = cues[0]
    if (!first) return
    const steps: PlaybackProgramStep[] = cues.map((cue) => ({
      id: cue.id, label: cue.id, url: cue.src, startMs: cue.startMs, endMs: cue.endMs, repeatCount: 1, waitAfterMs: 0,
    }))
    const request = ++attempt.current
    running.current = true
    setPlaybackError('')
    setRange({ timings: current, cues })
    setActiveCue({ id: first.id, timings: current })
    try {
      await start(steps)
    } catch {
      if (attempt.current === request) fail()
    }
  }

  return { audioRef, cues: current?.cues, loading: Boolean(sources?.length && !current),
    timingError: Boolean(current?.failed), playing, activeId: playing ? activeId : null,
    lastPlayedId: activeId, playbackError, play, preload, stop, syncPlayback }
}
