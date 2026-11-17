'use client'

import { useEffect, useRef, useState } from 'react'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { LearningIcon } from '@rosie/ui'
import { useAuth, useBaiduMediaError } from '@rosie/core'
import { Button, Select } from '@rosie/ui/themes'
import { useBaiduReadingAudio } from '../../hooks/useBaiduReadingAudio'
import { lessonAudioUrl } from '../../utils/reading-audio-types'
import type { StoryChapter } from '../../utils/story-types'

function NarrationTrack({ src, timeline, label }: { src: string; timeline: string; label: string }) {
  const player = usePlaylistPlayer()
  const { audioRef } = player
  const button = useRef<HTMLButtonElement>(null)
  const playbackError = useBaiduMediaError(audioRef)
  const [loading, setLoading] = useState(false)
  const activeTrack = player.current?.url === src
  const playing = activeTrack && player.isPlaying && !player.isPaused
  const [noTiming, setNoTiming] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const media = audioRef.current
    if (!media || !activeTrack) return
    const track = document.createElement('track')
    track.kind = 'metadata'
    track.src = timeline
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
      track.onerror = null
      track.remove()
      active?.removeAttribute('data-story-speaking')
    }
  }, [audioRef, activeTrack, timeline])
  return <>
    <Button ref={button} type="button" variant="soft" highContrast color="orange"
      loading={loading} aria-pressed={playing} aria-label={playing ? '暂停朗读' : '播放朗读'}
      onClick={async () => {
        if (activeTrack && player.isPlaying) {
          player.togglePause()
          return
        }
        setLoading(true)
        setFailed(false)
        try {
          await player.playWhenReady({ url: src, label, refLink: window.location.pathname, mediaType: 'audio', source: null })
        } catch {
          setFailed(true)
        } finally {
          setLoading(false)
        }
      }}>
      <LearningIcon name={playing ? 'pause' : 'readAloud'} />
      {playing ? '暂停朗读' : '朗读'}
    </Button>
    <PlayerDock player={player} theme="light" showProgress />
    {playbackError || failed ? <span role="alert">{playbackError || '音频播放失败，请检查网盘绑定。'}</span>
      : noTiming && <span className="text-xs">此音频暂无逐句时间表</span>}
  </>
}

export default function StoryNarration({ series, volume, chapters, full }: {
  series: string; volume: string; chapters: StoryChapter[]; full: boolean
}) {
  const { user } = useAuth()
  const { hasAudio, error, isLoading } = useBaiduReadingAudio(user)
  const key = `story:${series}:${volume}`
  const choices = [
    ...(full ? [{ slot: 'narration', file: 'full', label: '整本朗读' }] : []),
    ...chapters.map(ch => ({ slot: 'chapter:' + ch.key, file: ch.key, label: `第 ${ch.number} 辑 · ${ch.title}` })),
  ].filter(item => hasAudio(key + '#' + item.slot))
  const [selected, setSelected] = useState('')
  const current = choices.find(item => item.slot === selected) ?? choices[0]
  if (!current) return <span role="status" className="text-sm">
    {isLoading ? '正在读取朗读音频…' : error || '暂无已绑定的朗读音频'}
  </span>
  return <>
    {choices.length > 1 && <Select.Root value={current.slot} onValueChange={setSelected}>
      <Select.Trigger aria-label="选择朗读音频" />
      <Select.Content>{choices.map(item =>
        <Select.Item key={item.slot} value={item.slot}>{item.label}</Select.Item>)}</Select.Content>
    </Select.Root>}
    <NarrationTrack key={current.slot} label={current.label} src={lessonAudioUrl(key, current.slot)}
      timeline={`/story-timings/${series}/${volume}/${current.file}.vtt`} />
  </>
}
