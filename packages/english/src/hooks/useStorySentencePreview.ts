'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaybackProgram } from '@rosie/player'

type Bounds = { startMs: number; endMs: number }
type Timings = { url: string; cues: Map<string, Bounds>; failed: boolean }
type PlaybackRange = { timeline: string; cues: (Bounds & { id: string })[] }

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

export function useStorySentencePreview(source: { src: string; timeline: string } | undefined) {
  const { src, timeline } = source ?? {}
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
    if (!timeline) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(timeline, { signal: controller.signal })
        if (!response.ok && response.status !== 404) throw new Error('Story timing unavailable')
        const cues = response.ok ? readCues(await response.text()) : new Map<string, Bounds>()
        if (!controller.signal.aborted) setTimings({ url: timeline, cues, failed: false })
      } catch {
        if (!controller.signal.aborted) setTimings({ url: timeline, cues: new Map(), failed: true })
      }
    })()
    return () => controller.abort()
  }, [timeline])

  useEffect(() => () => {
    attempt.current += 1
    dispose()
  }, [src, timeline, dispose])

  const stop = useCallback(() => {
    attempt.current += 1
    dispose()
    setRange(null)
    setPlaybackError('')
  }, [dispose])

  const current = timeline && timings?.url === timeline ? timings : null
  const playing = range !== null && range.timeline === timeline

  function syncPlayback() {
    const media = audioRef.current
    if (!playing || !range || range.cues.length < 2 || !media || media.seeking) return
    const positionMs = media.currentTime * 1000
    const cue = range.cues.find(({ startMs, endMs }) => positionMs >= startMs && positionMs < endMs)
    setActiveId(cue?.id ?? null)
  }

  async function play(sentenceIds: readonly string[]) {
    if (!current || !src || !timeline) return
    const cues = sentenceIds.flatMap((id) => {
      const bounds = current.cues.get(id)
      return bounds ? [{ id, ...bounds }] : []
    }).sort((left, right) => left.startMs - right.startMs)
    const first = cues[0]
    if (!first) return
    const startMs = first.startMs
    const endMs = cues.reduce((latest, cue) => Math.max(latest, cue.endMs), first.endMs)
    const request = ++attempt.current
    setPlaybackError('')
    setRange({ timeline, cues })
    setActiveId(first.id)
    try {
      await start([{ id: first.id, url: src, label: first.id, startMs, endMs, repeatCount: 1, waitAfterMs: 0 }])
    } catch {
      if (attempt.current === request) fail()
    }
  }

  return { audioRef, cues: current?.cues, loading: Boolean(timeline && !current),
    timingError: Boolean(current?.failed), playing, activeId: playing ? activeId : null, playbackError, play, stop, syncPlayback }
}
