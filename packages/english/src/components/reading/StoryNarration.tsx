'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { LearningIcon } from '@rosie/ui'
import { useAuth, useBaiduMediaError } from '@rosie/core'
import { Button, Select } from '@rosie/ui/themes'
import { useBaiduReadingAudio } from '../../hooks/useBaiduReadingAudio'
import { audioAlignmentUrl, lessonAudioUrl } from '../../utils/reading-audio-types'
import type { StoryChapter, StoryVolume } from '../../utils/story-types'
import { storyNarrationTracks } from '../../utils/story-narration-tracks'

function NarrationError({ host, message }: { host: HTMLDivElement | null; message: string }) {
  return host && createPortal(<p role="alert" className="text-sm font-bold text-rose-700">{message}</p>, host)
}

function NarrationTrack({ src, timeline, label, errorHost, beforePlayback, inlinePlayer }: {
  src: string; timeline: string; label: string; errorHost: HTMLDivElement | null; beforePlayback: () => void; inlinePlayer: boolean
}) {
  const player = usePlaylistPlayer()
  const { audioRef } = player
  const button = useRef<HTMLButtonElement>(null)
  const playbackError = useBaiduMediaError(audioRef)
  const [loading, setLoading] = useState(false)
  const activeTrack = player.current?.url === src
  const playing = activeTrack && player.isPlaying && !player.isPaused
  const [noTiming, setNoTiming] = useState(false)
  const [timingRequest, setTimingRequest] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const media = audioRef.current
    if (!media || !activeTrack) return
    const track = document.createElement('track')
    track.kind = 'metadata'
    track.src = timeline
    track.onload = () => setNoTiming(false)
    track.onerror = () => setNoTiming(true)
    media.appendChild(track)
    const cues = track.track
    let active: HTMLElement | null = null
    function sync() {
      const cue = cues?.activeCues?.[0]
      const next = cue ? document.getElementById(cue.id) : null
      if (next === active) return
      active?.removeAttribute('data-story-speaking')
      active = next
      if (active?.hasAttribute('data-story-sentence')) {
        active.setAttribute('data-story-speaking', '')
        if (button.current?.closest('[data-story-reading-mode]')) return
        const rect = active.getBoundingClientRect()
        const toolbar = button.current?.closest('.sticky')?.getBoundingClientRect()
        if (rect.top < (toolbar?.bottom ?? 0) || rect.bottom > window.innerHeight)
          active.scrollIntoView({ block: 'center' })
      }
    }
    cues.mode = 'hidden'
    cues.addEventListener('cuechange', sync)
    sync()
    return () => {
      cues.removeEventListener('cuechange', sync)
      track.onload = null
      track.onerror = null
      track.remove()
      active?.removeAttribute('data-story-speaking')
    }
  }, [audioRef, activeTrack, timeline, timingRequest])
  return <>
    <Button ref={button} type="button" variant="soft" highContrast color="orange"
      loading={loading} aria-pressed={playing} aria-label={playing ? '暂停朗读' : '播放朗读'}
      onClick={async () => {
        beforePlayback()
        if (activeTrack && player.isPlaying) {
          if (player.isPaused) setTimingRequest(request => request + 1)
          player.togglePause()
          return
        }
        setLoading(true)
        setFailed(false)
        try {
          await player.playWhenReady({ url: src, label, refLink: window.location.pathname, mediaType: 'audio', source: null })
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
        } finally {
          setLoading(false)
        }
      }}>
      <span className="inline-flex items-center gap-1">
        <LearningIcon name={playing ? 'pause' : 'readAloud'} />
        {playing ? '暂停朗读' : '朗读'}
      </span>
    </Button>
    <PlayerDock player={player} theme="light" showProgress placement={inlinePlayer ? 'inline' : 'floating'} />
    {playbackError || failed ? <NarrationError host={errorHost} message={playbackError || '音频播放失败，请检查网盘绑定。'} />
      : noTiming && <span className="text-xs">此音频暂无逐句时间表</span>}
  </>
}

type TrackRange = { file: string; startMs: number; endMs: number; partial?: boolean }

export function useStoryNarration({ series, volume, chapters, full }: {
  series: string; volume: Pick<StoryVolume, 'slug' | 'originalAudioFiles'>; chapters: StoryChapter[]; full: boolean
}) {
  const { user } = useAuth()
  const { hasAudio, error, isLoading } = useBaiduReadingAudio(user)
  const key = `story:${series}:${volume.slug}`
  const base = `/story-timings/${series}/${volume.slug}`
  const chapter = !full && chapters.length === 1 ? chapters[0] : undefined
  const [index, setIndex] = useState<{ base: string; chapters: Record<string, TrackRange[]> } | null>(null)
  const needsIndex = Boolean(chapter && !chapter.fullNarrationRange && volume.originalAudioFiles?.some(
    filename => filename === `${volume.slug}.mp3` || filename.startsWith('part-'),
  ))
  useEffect(() => {
    if (!needsIndex) return
    const controller = new AbortController()
    void fetch(`${base}/track-index.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return
      const body = await response.json()
      if (body?.chapters && !controller.signal.aborted) setIndex({ base, chapters: body.chapters })
    }).catch(() => {})
    return () => controller.abort()
  }, [base, needsIndex])
  const choices = useMemo(() => {
    const ranges = chapter && index?.base === base ? index.chapters[chapter.key] : undefined
    const tracks = storyNarrationTracks(volume, chapters)
    // A dedicated chapter recording is the first choice on a chapter page.
    if (chapter) tracks.sort((a, b) => Number(b.slot.startsWith('chapter:')) - Number(a.slot.startsWith('chapter:')))
    return tracks.flatMap(item => {
      if (!hasAudio(key + '#' + item.slot)) return []
      if (chapter && (item.file === 'title' || item.file === 'credits')) return []
      const indexed = ranges?.find(entry => entry.file === item.file)
      const range = indexed ?? (item.file === 'full' ? chapter?.fullNarrationRange : undefined)
      if (ranges?.length && item.file.startsWith('part-') && !range) return []
      const src = lessonAudioUrl(key, item.slot)
      const label = indexed?.partial ? `本章已定位片段 · ${item.label}`
        : range && item.file === 'full' ? '本章朗读（整本录音）' : item.label
      return [{
        slot: item.slot,
        label,
        src,
        playbackUrl: range && range.endMs > range.startMs ? `${src}#t=${range.startMs / 1000},${range.endMs / 1000}` : src,
        timeline: item.file === 'title' || item.file === 'credits'
          ? `${base}/${item.file}.vtt` : audioAlignmentUrl(key, item.slot),
      }]
    })
  }, [base, chapter, chapters, hasAudio, index, key, volume])
  const [selected, setSelected] = useState('')
  const current = choices.find(item => item.slot === selected)
    ?? choices.find(item => item.slot !== 'track:title' && item.slot !== 'track:credits') ?? choices[0]
  const previewTracks = useMemo(() => {
    if (!current || current.slot === 'track:title' || current.slot === 'track:credits') return []
    if (current.slot.startsWith('track:part-')) return choices.filter(item => item.slot.startsWith('track:part-'))
    if (full && volume.originalAudioFiles && current.slot.startsWith('chapter:')) {
      return choices.filter(item => item.slot.startsWith('chapter:'))
    }
    return [current]
  }, [choices, current, full, volume.originalAudioFiles])
  return { choices, current, previewTracks, setSelected, isLoading, error }
}

export default function StoryNarration({ narration, errorHost, beforePlayback, inlinePlayer }: {
  narration: ReturnType<typeof useStoryNarration>; errorHost: HTMLDivElement | null; beforePlayback: () => void; inlinePlayer: boolean
}) {
  const { choices, current, setSelected, isLoading, error } = narration
  if (!current) {
    if (!isLoading && error) return <NarrationError host={errorHost} message={error} />
    return <span role="status" className="text-sm">
      {isLoading ? '正在读取朗读音频…' : '暂无已绑定的朗读音频'}
    </span>
  }
  return <>
    {choices.length > 1 && <Select.Root value={current.slot} onValueChange={(slot) => {
      beforePlayback()
      setSelected(slot)
    }}>
      <Select.Trigger aria-label="选择朗读音频" />
      <Select.Content>{choices.map(item =>
        <Select.Item key={item.slot} value={item.slot}>{item.label}</Select.Item>)}</Select.Content>
    </Select.Root>}
    <NarrationTrack key={current.playbackUrl} label={current.label} src={current.playbackUrl} errorHost={errorHost}
      timeline={current.timeline} beforePlayback={beforePlayback} inlinePlayer={inlinePlayer} />
  </>
}
