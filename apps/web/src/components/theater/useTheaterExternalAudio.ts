'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

const driftToleranceSeconds = 0.25

export function useTheaterExternalAudio(videoRef: RefObject<HTMLVideoElement | null>, requested: boolean, source: string | undefined) {
  const externalRef = useRef<HTMLAudioElement>(null)
  const requestPlay = useRef<(() => void) | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [muted, setMuted] = useState(false)
  const active = requested && !failed

  useEffect(() => {
    const video = videoRef.current
    const audio = externalRef.current
    if (!active || !video || !audio) return
    const previousMuted = video.muted
    let waiting = video.readyState < 3
    let playPending = false
    let autoplayBlocked = false
    const controller = new AbortController()
    const options = { signal: controller.signal }

    function syncVolume() {
      if (!video || !audio) return
      if (!video.muted) video.muted = true
      if (audio.volume !== video.volume) audio.volume = video.volume
    }

    function align(force: boolean) {
      if (!video || !audio || audio.readyState < 1 || !Number.isFinite(video.currentTime)) return
      const target = Math.min(video.currentTime, Number.isFinite(audio.duration) ? audio.duration : video.currentTime)
      const drift = Math.abs(audio.currentTime - target)
      if ((force && drift > 0.02) || (audio.readyState >= 2 && !audio.seeking && drift > driftToleranceSeconds))
        audio.currentTime = target
    }

    function sync(force = false) {
      if (!video || !audio) return
      if (audio.playbackRate !== video.playbackRate) audio.playbackRate = video.playbackRate
      align(force)
      if (waiting || video.paused || video.seeking || video.ended) {
        if (!audio.paused) audio.pause()
        return
      }
      if (playPending || autoplayBlocked || !audio.paused || audio.ended) return
      playPending = true
      void audio.play().then(() => {
        if (!controller.signal.aborted) setBlocked(false)
      }).catch((error: unknown) => {
        if (controller.signal.aborted || video.paused || waiting || video.seeking) return
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          autoplayBlocked = true
          setBlocked(true)
        } else if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
      }).finally(() => { playPending = false })
    }

    const syncPlayback = () => sync()
    const syncPosition = () => sync(true)
    const wait = () => { waiting = true; syncPlayback() }
    const play = () => { waiting = false; syncPosition() }
    requestPlay.current = () => { autoplayBlocked = false; syncPosition() }
    audio.muted = previousMuted
    syncVolume()
    for (const event of ['pause', 'ended', 'ratechange', 'timeupdate']) video.addEventListener(event, syncPlayback, options)
    for (const event of ['seeking', 'seeked', 'loadedmetadata']) video.addEventListener(event, syncPosition, options)
    video.addEventListener('waiting', wait, options)
    video.addEventListener('playing', play, options)
    video.addEventListener('volumechange', syncVolume, options)
    audio.addEventListener('loadedmetadata', syncPosition, options)
    audio.addEventListener('canplay', syncPlayback, options)
    syncPosition()
    return () => {
      controller.abort()
      audio.pause()
      video.muted = previousMuted
      requestPlay.current = null
    }
  }, [active, source, videoRef])

  return {
    externalRef, active, blocked, failed, muted,
    onError: () => setFailed(true),
    onVolumeChange: (audio: HTMLAudioElement) => setMuted(audio.muted),
    toggleMute: () => { const audio = externalRef.current; if (audio) audio.muted = !audio.muted },
    retry: () => { setFailed(false); setBlocked(false); requestPlay.current?.() },
  }
}
