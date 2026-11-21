'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaybackProgram, type PlaybackProgramStep } from '@rosie/player'

type Bounds = { startMs: number; endMs: number }
type Source = { src: string; timeline: string }
type LocatedCue = Bounds & { id: string; src: string }
type Timings = { sources: readonly Source[]; cues: Map<string, LocatedCue[]>; failed: boolean }
type PlaybackRange = { timings: Timings; cues: LocatedCue[] }

function timestampMs(value: string) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
}

function readCues(text: string) {
  const cues = new Map<string, Bounds>()
  const pattern = /^([a-z0-9-]+-s\d+)\r?\n(\d{2,}:[0-5]\d:[0-5]\d\.\d{3})[ \t]+-->[ \t]+(\d{2,}:[0-5]\d:[0-5]\d\.\d{3})(?=[ \t\r\n]|$)/gm
  if (!/^\uFEFF?WEBVTT(?:[ \t\r\n]|$)/.test(text)) return cues
  for (const [, id, start, end] of text.matchAll(pattern)) {
    const startMs = timestampMs(start)
    const endMs = timestampMs(end)
    if (Number.isSafeInteger(startMs) && Number.isSafeInteger(endMs) && startMs < endMs) {
      cues.set(id, { startMs, endMs })
    }
  }
  return cues
}

export function useStorySentencePreview(sources: readonly Source[] | undefined) {
  const [timings, setTimings] = useState<Timings | null>(null)
  const [range, setRange] = useState<PlaybackRange | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState('')
  const attempt = useRef(0)
  const fail = useCallback(() => {
    setRange(null)
    setPlaybackError('试听未能完成，请重试。')
  }, [])
  const complete = useCallback(() => setRange(null), [])
  const { audioRef, start, dispose } = usePlaybackProgram(fail, complete)

  useEffect(() => {
    if (!sources?.length) return
    const controller = new AbortController()
    void (async () => {
      const tracks = await Promise.allSettled(sources.map(async source => {
        const response = await fetch(source.timeline, { signal: controller.signal })
        if (response.status === 404) return []
        if (!response.ok) throw new Error('Story timing unavailable')
        return Array.from(readCues(await response.text()), ([id, bounds]) => ({ ...bounds, id, src: source.src }))
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
    dispose()
  }, [sources, dispose])

  const stop = useCallback(() => {
    attempt.current += 1
    dispose()
    setRange(null)
    setPlaybackError('')
  }, [dispose])

  const current = timings && timings.sources === sources ? timings : null
  const playing = range !== null && range.timings === current

  function syncPlayback() {
    const media = audioRef.current
    if (!playing || !range || range.cues.length < 2 || !media || media.seeking) return
    const positionMs = media.currentTime * 1000
    const src = media.getAttribute('src')
    const cue = range.cues.find(cue => cue.src === src && positionMs >= cue.startMs && positionMs < cue.endMs)
    setActiveId(cue?.id ?? null)
  }

  async function play(sentenceIds: readonly string[]) {
    if (!current) return
    const cues = sentenceIds.flatMap(id => current.cues.get(id) ?? [])
    const first = cues[0]
    if (!first) return
    const steps: PlaybackProgramStep[] = []
    for (const cue of cues) {
      const last = steps.at(-1)
      if (last && last.url === cue.src) {
        last.startMs = Math.min(last.startMs, cue.startMs)
        last.endMs = Math.max(last.endMs, cue.endMs)
      } else {
        steps.push({ id: cue.id, label: cue.id, url: cue.src, startMs: cue.startMs, endMs: cue.endMs, repeatCount: 1, waitAfterMs: 0 })
      }
    }
    const request = ++attempt.current
    setPlaybackError('')
    setRange({ timings: current, cues })
    setActiveId(first.id)
    try {
      await start(steps)
    } catch {
      if (attempt.current === request) fail()
    }
  }

  return { audioRef, cues: current?.cues, loading: Boolean(sources?.length && !current),
    timingError: Boolean(current?.failed), playing, activeId: playing ? activeId : null, playbackError, play, stop, syncPlayback }
}
