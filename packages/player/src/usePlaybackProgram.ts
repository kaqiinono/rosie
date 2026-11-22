'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { acquirePlaybackLease } from './playbackLease'

export interface PlaybackProgramStep {
  id: string
  url: string
  label: string
  startMs: number
  endMs: number
  repeatCount: number
  waitAfterMs: number
}
export type PlaybackProgramStatus = 'idle' | 'playing' | 'waiting' | 'ended' | 'failed'
export interface PlaybackProgramController {
  audioRef: RefObject<HTMLVideoElement | null>
  status: PlaybackProgramStatus
  label: string
  start: (steps: readonly PlaybackProgramStep[], positionMs?: number) => Promise<void>
  dispose: () => void
  positionMs: () => number
}

/** A reviewed, finite program owns transport commands for its entire lifetime.
 * There is no public pause/seek/rate/loop/skip API. Technical interruption ends
 * this program; the caller resumes only from a newly authorized position.
 */
export function usePlaybackProgram(onFailure: () => void, onComplete?: () => void, {
  reuseLoadedSource = false,
}: { reuseLoadedSource?: boolean } = {}): PlaybackProgramController {
  const audioRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<PlaybackProgramStatus>('idle')
  const [label, setLabel] = useState('')
  const release = useRef<(() => void) | null>(null)
  const generation = useRef(0)
  const cleanup = useRef<(() => void) | null>(null)
  const position = useRef(0)
  const positionReader = useRef<() => number>(() => position.current)
  const callbacks = useRef({ onFailure, onComplete })
  useEffect(() => {
    callbacks.current = { onFailure, onComplete }
  }, [onFailure, onComplete])

  const reset = useCallback((keepSource: boolean) => {
    generation.current += 1
    cleanup.current?.(); cleanup.current = null
    const media = audioRef.current
    if (media) {
      media.pause()
      if (!keepSource) { media.removeAttribute('src'); media.load() }
    }
    release.current?.(); release.current = null
    positionReader.current = () => position.current
  }, [])
  const dispose = useCallback(() => reset(false), [reset])

  const start = useCallback(async (steps: readonly PlaybackProgramStep[], positionMs = 0) => {
    const media = audioRef.current
    reset(Boolean(reuseLoadedSource && media?.paused && !media.error && media.getAttribute('src') === steps[0]?.url))
    if (!media || !steps.length || !Number.isFinite(positionMs) || positionMs < 0 || steps.some(step => !Number.isFinite(step.startMs)
      || !Number.isFinite(step.endMs) || step.startMs < 0 || step.endMs <= step.startMs
      || !Number.isSafeInteger(step.repeatCount) || step.repeatCount < 1 || step.repeatCount > 100
      || !Number.isFinite(step.waitAfterMs) || step.waitAfterMs < 0)) throw new Error('Invalid playback program')
    const lease = acquirePlaybackLease()
    if (!lease) throw new Error('Another playback program is active')
    release.current = lease
    const run = generation.current
    const timeline = steps.flatMap(step => {
      const repeated = Array.from({ length: step.repeatCount }, () => ({ step, waiting: false, duration: step.endMs - step.startMs }))
      return step.waitAfterMs > 0 ? [...repeated, { step, waiting: true, duration: step.waitAfterMs }] : repeated
    })
    let base = 0
    let index = 0
    while (index < timeline.length && base + timeline[index].duration <= positionMs) { base += timeline[index].duration; index += 1 }
    const fail = () => {
      if (generation.current !== run) return
      position.current = positionReader.current()
      dispose(); setStatus('failed'); callbacks.current.onFailure()
    }
    const advance = async (offset = 0): Promise<void> => {
      if (generation.current !== run) return
      cleanup.current?.(); cleanup.current = null
      if (index >= timeline.length) {
        position.current = base
        dispose(); setStatus('ended'); callbacks.current.onComplete?.(); return
      }
      const entry = timeline[index]
      setLabel(entry.step.label)
      let finished = false
      const next = () => {
        if (finished || generation.current !== run) return
        finished = true; base += entry.duration; index += 1
        void advance().catch(fail)
      }
      if (entry.waiting) {
        media.pause(); setStatus('waiting')
        const started = performance.now()
        positionReader.current = () => base + Math.min(entry.duration, offset + performance.now() - started)
        const timer = setTimeout(next, Math.max(0, entry.duration - offset))
        cleanup.current = () => clearTimeout(timer)
        return
      }
      setStatus('playing')
      const sameSource = reuseLoadedSource && !media.error && media.getAttribute('src') === entry.step.url
      if (!sameSource) media.src = entry.step.url
      media.playbackRate = 1
      media.loop = false
      let lastPosition = (entry.step.startMs + offset) / 1000
      let positioning = true
      let stallTimer: ReturnType<typeof setTimeout> | null = null
      const ready = () => {
        if (!sameSource || Math.abs(media.currentTime - lastPosition) > 0.01) media.currentTime = lastPosition
        positioning = false
      }
      const time = () => {
        if (positioning || (reuseLoadedSource && media.seeking)) return
        lastPosition = media.currentTime
        if (media.currentTime * 1000 >= entry.step.endMs - 25) next()
      }
      const ended = () => media.currentTime * 1000 + 250 < entry.step.endMs ? fail() : next()
      const paused = () => { if (!finished && !media.ended && generation.current === run) fail() }
      const seeking = () => {
        if (!positioning && Math.abs(media.currentTime - lastPosition) > 0.75) {
          positioning = true; media.currentTime = lastPosition; positioning = false
        }
      }
      const rate = () => { if (media.playbackRate !== 1) media.playbackRate = 1 }
      const stalled = () => { if (stallTimer === null) stallTimer = setTimeout(fail, 8000) }
      const playing = () => { if (stallTimer !== null) clearTimeout(stallTimer); stallTimer = null }
      positionReader.current = () => base + Math.max(0, Math.min(entry.duration, media.currentTime * 1000 - entry.step.startMs))
      if (sameSource && media.readyState >= 1) ready()
      else media.addEventListener('loadedmetadata', ready, { once: true })
      media.addEventListener('timeupdate', time); media.addEventListener('ended', ended)
      media.addEventListener('error', fail); media.addEventListener('pause', paused)
      media.addEventListener('seeking', seeking); media.addEventListener('ratechange', rate)
      media.addEventListener('waiting', stalled); media.addEventListener('playing', playing)
      cleanup.current = () => {
        media.removeEventListener('loadedmetadata', ready); media.removeEventListener('timeupdate', time)
        media.removeEventListener('ended', ended); media.removeEventListener('error', fail); media.removeEventListener('pause', paused)
        media.removeEventListener('seeking', seeking); media.removeEventListener('ratechange', rate)
        media.removeEventListener('waiting', stalled); media.removeEventListener('playing', playing)
        if (stallTimer !== null) clearTimeout(stallTimer)
      }
      try { await media.play() } catch { fail() }
    }
    await advance(positionMs - base)
  }, [dispose, reset, reuseLoadedSource])

  useEffect(() => () => dispose(), [dispose])
  const positionMs = useCallback(() => positionReader.current(), [])
  return { audioRef, status, label, start, dispose, positionMs }
}
