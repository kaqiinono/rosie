'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import type Hls from 'hls.js'
import { supabase, useAuth } from '@rosie/core'
import { usePlaylistPlayer } from '@rosie/player'
import { LoadingOverlay, PageBreadcrumb, SelectControl, StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Text, TextField } from '@rosie/ui/themes'
import { requestTheater } from '@/lib/theater/client'
import { activeTheaterCue, cueIndexAtOrBefore, mergeTheaterTracks, theaterTime } from '@/lib/theater/subtitle-timeline'
import type { SubtitleTracks, TheaterCue, TheaterFilm, TheaterStudyItem, TheaterSubtitles } from '@/lib/theater/types'
import TheaterLearningPanel from './TheaterLearningPanel'
import TheaterSubtitleEditor from './TheaterSubtitleEditor'
import { useTheaterProgress } from './useTheaterProgress'

type CaptionMode = 'both' | 'en' | 'zh' | 'off'
type Loop = { startMs: number; endMs: number; cueId?: string }
type OpenFilm = TheaterSubtitles & { film: TheaterFilm }
type PlaybackSource = 'original' | 'hls' | 'copy'
const captionLabels = { both: '双语', en: '英文', zh: '中文', off: '关闭' }
const captionModes = ['both', 'en', 'zh'] as const
const pageSize = 30

function vttTime(ms: number) {
  const hours = String(Math.floor(ms / 3_600_000)).padStart(2, '0')
  return hours + new Date(ms).toISOString().slice(13, 23)
}

function vttLine(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n{2,}/g, '\n')
}

function buildCaptionVtt(cues: TheaterCue[], showBoth: boolean) {
  const captions: Partial<Record<typeof captionModes[number], string>> = {}
  for (const mode of captionModes) {
    if (mode === 'both' && !showBoth) continue
    const lines = cues.flatMap(cue => {
      const text = mode === 'both' ? [cue.en, cue.zh].filter(Boolean).join('\n') : cue[mode]
      return text ? [vttTime(cue.startMs) + ' --> ' + vttTime(cue.endMs) + '\n' + vttLine(text)] : []
    })
    if (lines.length) captions[mode] = 'WEBVTT\n\n' + lines.join('\n\n')
  }
  return captions
}

function CaptionTrack({ vtt, mode, active, onLoad }: {
  vtt: string
  mode: typeof captionModes[number]
  active: boolean
  onLoad: () => void
}) {
  const track = useRef<HTMLTrackElement>(null)
  useEffect(() => {
    if (!track.current) return
    const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
    track.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [vtt])
  return <track ref={track} kind="subtitles" srcLang={mode === 'en' ? 'en' : 'zh'}
    label={captionLabels[mode]} default={active} onLoad={onLoad} />
}

export default function TheaterPlayer({ filmId }: { filmId: string }) {
  const { user } = useAuth()
  return user ? <TheaterLoader key={user.id + ':' + filmId} filmId={filmId} userId={user.id} /> : null
}

function TheaterLoader({ filmId, userId }: { filmId: string; userId: string }) {
  const [resource, setResource] = useState<OpenFilm | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function open() {
      try {
        const [film, subtitles] = await Promise.all([
          requestTheater<TheaterFilm>(userId, '/api/theater?filmId=' + filmId, { signal }),
          requestTheater<TheaterSubtitles>(userId, '/api/theater/' + filmId + '/subtitles', { signal }),
        ])
        if (signal.aborted) return
        await requestTheater(userId, '/api/theater/session', { method: 'POST', signal })
        if (!signal.aborted) setResource({ film, ...subtitles })
      } catch (cause) {
        if (!signal.aborted) setError(cause instanceof Error ? cause.message : '暂时无法打开影片。')
      }
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user.id === userId) {
        queueMicrotask(() => {
          if (!signal.aborted)
            void requestTheater(userId, '/api/theater/session', { method: 'POST', signal }).catch(() => {})
        })
      }
    })
    void open()
    return () => {
      controller.abort()
      data.subscription.unsubscribe()
    }
  }, [attempt, filmId, userId])

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1200px] flex-col gap-4 px-4 pb-8 pt-14 sm:px-6">
      <PageBreadcrumb variant="inline" />
      <Heading as="h1" size="7" className="break-words">{resource?.film.title ?? '电影剧场'}</Heading>
      {!resource && !error && <div className="relative min-h-48 flex-1"><LoadingOverlay visible placement="content" /></div>}
      {error && <StickerCard><Flex gap="3" align="center" wrap="wrap">
        <Text role="alert">{error}</Text>
        <Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>重试</Button>
      </Flex></StickerCard>}
      {resource && <FilmWorkspace resource={resource} userId={userId}
        onTracksChange={tracks => setResource(previous => previous && { ...previous, tracks })}
        onReload={() => { setResource(null); setAttempt(value => value + 1) }} />}
    </main>
  )
}

function FilmWorkspace({ resource, userId, onReload, onTracksChange }: {
  resource: OpenFilm
  userId: string
  onReload: () => void
  onTracksChange: (tracks: SubtitleTracks) => void
}) {
  const { film, tracks, canEdit } = resource
  const cues = useMemo(() => mergeTheaterTracks(tracks), [tracks])
  const [editingCue, setEditingCue] = useState<TheaterCue | null>(null)
  const { audioRef, notifyPlay, notifyPause } = usePlaylistPlayer()
  const { resume, message, reading, reload, save } = useTheaterProgress(userId, film.id)
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState('1')
  const [caption, setCaption] = useState<CaptionMode>(film.languages.length === 2 ? 'both' : film.languages[0] ?? 'off')
  const [selected, setSelected] = useState<TheaterCue>()
  const [loop, setLoop] = useState<Loop | null>(null)
  const [markA, setMarkA] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [pageOverride, setPageOverride] = useState<number | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [isBuffering, setIsBuffering] = useState(true)
  const [loopError, setLoopError] = useState('')
  const hasPlayback = useRef(false)
  const lastSaveAt = useRef(0)
  const animation = useRef<number>(0)
  const loopRef = useRef<Loop | null>(null)
  const restored = useRef<typeof resume>(null)
  const switchPosition = useRef<number | null>(null)
  const sources = useMemo<PlaybackSource[]>(() => {
    const ordered: PlaybackSource[] = film.format === 'rmvb' ? ['hls'] : ['original']
    if (film.format === 'mkv') ordered.push('hls')
    if (film.hasPlaybackCopy) ordered.push('copy')
    return ordered
  }, [film.format, film.hasPlaybackCopy])
  const source = sources[sourceIndex]
  const mediaRoot = '/api/theater/' + film.id
  const showBothCaptions = film.languages.length === 2
  const captions = useMemo(() => buildCaptionVtt(cues, showBothCaptions), [cues, showBothCaptions])
  const current = useMemo(() => activeTheaterCue(cues, time), [cues, time])
  const learningCue = selected ? cues.find(cue => cue.id === selected.id) ?? selected : current
  const queryText = query.trim().toLowerCase()
  const filtered = useMemo(() => queryText
    ? cues.filter(cue => [cue.en, cue.zh].some(value => value?.toLowerCase().includes(queryText)))
    : cues, [cues, queryText])
  const atOrBefore = cueIndexAtOrBefore(cues, time)
  const autoPage = queryText ? 0 : Math.floor(Math.max(0, atOrBefore) / pageSize)
  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  const page = Math.min(maxPage, pageOverride ?? autoPage)
  const captionOptions = [...captionModes.filter(mode => mode === 'both'
    ? film.languages.length === 2 : film.languages.includes(mode)), 'off' as const]

  const setPlaybackLoop = useCallback((value: Loop | null) => {
    loopRef.current = value
    setLoop(value)
  }, [])

  const positionMs = (video: HTMLVideoElement) => Math.round(video.currentTime * 1000)
  const failPlaybackSource = useCallback(() => {
    if (sourceIndex + 1 >= sources.length) {
      setIsBuffering(false)
      setVideoError(true)
      return
    }
    const video = audioRef.current
    if (video && video.currentTime > 0) switchPosition.current = video.currentTime
    restored.current = null
    setIsBuffering(true)
    setVideoError(false)
    setSourceIndex(sourceIndex + 1)
  }, [audioRef, sourceIndex, sources.length])

  useEffect(() => {
    if (reading || source !== 'hls' || !audioRef.current) return
    const video = audioRef.current
    const src = mediaRoot + '/hls'
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }
    let disposed = false
    let player: Hls | undefined
    void import('hls.js').then(({ default: HlsPlayer }) => {
      if (disposed) return
      if (!HlsPlayer.isSupported()) { failPlaybackSource(); return }
      player = new HlsPlayer({ enableWorker: true })
      player.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (!disposed && data.fatal) failPlaybackSource()
      })
      player.loadSource(src)
      player.attachMedia(video)
    }).catch(() => { if (!disposed) failPlaybackSource() })
    return () => { disposed = true; player?.destroy() }
  }, [audioRef, failPlaybackSource, mediaRoot, reading, source])

  const flush = useCallback(() => {
    const video = audioRef.current
    if (video && hasPlayback.current && !video.seeking && !video.error) void save(positionMs(video))
  }, [audioRef, save])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      cancelAnimationFrame(animation.current)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])

  const applyResume = useCallback(() => {
    const video = audioRef.current
    if (!video || video.readyState < 1 || !resume || restored.current === resume) return
    restored.current = resume
    if (!Number.isFinite(video.duration)) return
    const position = Math.min(resume.position_ms / 1000, Math.max(0, video.duration - 0.1))
    if (position || hasPlayback.current) video.currentTime = position
    setTime(Math.round(position * 1000))
  }, [audioRef, resume])
  useEffect(() => { applyResume() }, [applyResume])

  const applyCaptions = useCallback(() => {
    const video = audioRef.current
    if (!video) return
    for (const track of Array.from(video.textTracks)) {
      const mode = track.label === captionLabels[caption] ? 'showing' : 'disabled'
      if (track.mode !== mode) track.mode = mode
    }
  }, [audioRef, caption])
  useEffect(() => { applyCaptions() }, [applyCaptions, captions])

  function tick(video: HTMLVideoElement) {
    if (video.seeking) return
    const position = positionMs(video)
    const activeLoop = loopRef.current
    if (!video.paused && activeLoop && position >= activeLoop.endMs) {
      video.currentTime = activeLoop.startMs / 1000
      setTime(activeLoop.startMs)
      return
    }
    setTime(previous => Math.abs(previous - position) >= 80 ? position : previous)
    if (!video.paused && Date.now() - lastSaveAt.current >= 8000) {
      lastSaveAt.current = Date.now()
      flush()
    }
  }

  function play(event: SyntheticEvent<HTMLVideoElement>) {
    notifyPlay()
    const video = event.currentTarget
    if (video.paused) return
    hasPlayback.current = true
    lastSaveAt.current = Date.now()
    cancelAnimationFrame(animation.current)
    const update = () => {
      if (video.paused || video.ended || !video.isConnected) return
      tick(video)
      animation.current = requestAnimationFrame(update)
    }
    animation.current = requestAnimationFrame(update)
  }

  function pause() {
    cancelAnimationFrame(animation.current)
    notifyPause()
    flush()
  }

  function seek(ms: number) {
    const video = audioRef.current
    if (!video || video.readyState < 1) return
    video.currentTime = Math.max(0, Math.min(ms / 1000, video.duration))
    setTime(positionMs(video))
  }

  function chooseCue(cue: TheaterCue) {
    setPlaybackLoop(null)
    setMarkA(null)
    setSelected(cue)
    setPageOverride(null)
    seek(cue.startMs)
  }

  function navigateCue(direction: -1 | 1) {
    const target = cues[Math.max(0, atOrBefore + direction)]
    if (target) chooseCue(target)
  }

  function loopCue(cue: TheaterCue) {
    const video = audioRef.current
    if (!video || video.readyState < 1 || !Number.isFinite(video.duration)) return
    const endMs = Math.min(cue.endMs, Math.round(video.duration * 1000))
    if (endMs <= cue.startMs) { setLoopError('这句字幕超出影片时长。'); return }
    setLoopError('')
    setMarkA(null)
    setSelected(cue)
    setPageOverride(null)
    setPlaybackLoop({ startMs: cue.startMs, endMs, cueId: cue.id })
    seek(cue.startMs)
    void video.play().catch(() => setLoopError('点击视频播放键开始复读。'))
  }

  function setB() {
    const video = audioRef.current
    if (markA === null || !video || video.readyState < 1) return
    const b = positionMs(video)
    if (b <= markA + 250) { setLoopError('B 点需比 A 点至少晚 0.25 秒。'); return }
    setLoopError('')
    setPlaybackLoop({ startMs: markA, endMs: b })
    seek(markA)
    void video.play().catch(() => setLoopError('点击视频播放键开始复读。'))
  }

  function review(item: TheaterStudyItem) {
    const cue = cues.find(value => value.id === item.item_key) ??
      cues.find(value => value.startMs === item.position_ms)
    if (cue) loopCue(cue)
    else {
      setPlaybackLoop(null)
      setSelected(undefined)
      seek(item.position_ms)
    }
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <StickerCard as="section" aria-label="影片播放器" size="sm" className="min-w-0">
        <Flex direction="column" gap="3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {!reading && <video key={source} ref={audioRef}
              src={source === 'hls' ? undefined : mediaRoot + '/video' + (source === 'copy' ? '?copy=1' : '')} controls playsInline
              preload="metadata" aria-label={film.title} className="h-full w-full"
              onPlay={play} onPause={pause}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onTimeUpdate={event => tick(event.currentTarget)}
              onLoadedMetadata={event => {
                setIsBuffering(false)
                event.currentTarget.playbackRate = Number(rate)
                const previousPosition = switchPosition.current
                if (previousPosition !== null && Number.isFinite(event.currentTarget.duration)) {
                  switchPosition.current = null
                  restored.current = resume
                  event.currentTarget.currentTime = Math.min(previousPosition, Math.max(0, event.currentTarget.duration - 0.1))
                } else applyResume()
                applyCaptions()
              }}
              onSeeking={event => {
                const position = positionMs(event.currentTarget)
                const activeLoop = loopRef.current
                if (activeLoop && (position < activeLoop.startMs - 100 || position > activeLoop.endMs + 250))
                  setPlaybackLoop(null)
              }}
              onSeeked={event => { setTime(positionMs(event.currentTarget)); flush() }}
              onEnded={event => {
                const activeLoop = loopRef.current
                if (activeLoop) {
                  const video = event.currentTarget
                  video.currentTime = activeLoop.startMs / 1000
                  void video.play().catch(() => setLoopError('点击视频播放键继续复读。'))
                } else pause()
              }}
              onError={failPlaybackSource}>
              {captionModes.map(mode => {
                const vtt = captions[mode]
                return vtt && <CaptionTrack key={mode} vtt={vtt} mode={mode}
                  active={caption === mode} onLoad={applyCaptions} />
              })}
            </video>}
            {reading && <LoadingOverlay visible placement="content" />}
          </div>
          {isBuffering && <Text role="status" size="2" color="gray">正在缓冲…</Text>}
          {videoError && <Flex gap="2" align="center" wrap="wrap">
            <Text role="alert" size="2">{film.format === 'mp4' || film.hasPlaybackCopy
              ? '影片播放失败。若重试仍失败，请家长核对文件或网盘授权。'
              : '当前无法播放这部影片，请家长检查网盘转码或关联 MP4 播放副本。'}</Text>
            <Button variant="soft" onClick={onReload}>重新打开</Button>
          </Flex>}
          {message && <Flex gap="2" align="center" wrap="wrap">
            <Text role="status" size="2">{message}</Text>
            <Button variant="soft" onClick={() => {
              audioRef.current?.pause()
              setPlaybackLoop(null)
              void reload()
            }}>读取云端进度</Button>
            {message.startsWith('暂时无法保存') && <Button variant="soft" onClick={flush}>重试保存</Button>}
          </Flex>}
          <Flex gap="2" wrap="wrap" align="center">
            <Button variant="soft" disabled={!cues.length || reading} onClick={() => navigateCue(-1)}>上一句</Button>
            <Button variant="soft" disabled={!cues.length || reading} onClick={() => navigateCue(1)}>下一句</Button>
            <Button variant={loop?.cueId ? 'solid' : 'soft'} aria-pressed={Boolean(loop?.cueId)}
              disabled={!learningCue || reading} onClick={() => {
                if (loop?.cueId) setPlaybackLoop(null)
                else if (learningCue) loopCue(learningCue)
              }}>{loop?.cueId ? '结束单句复读' : '单句复读'}</Button>
            <Button variant="soft" disabled={reading || videoError} onClick={() => {
              if (!audioRef.current) return
              setPlaybackLoop(null)
              setLoopError('')
              setMarkA(positionMs(audioRef.current))
            }}>设置 A 点</Button>
            <Button variant="soft" disabled={markA === null || reading} onClick={setB}>设置 B 点</Button>
            {markA !== null && <Button variant="ghost" onClick={() => {
              setPlaybackLoop(null)
              setMarkA(null)
              setLoopError('')
            }}>清除 AB</Button>}
          </Flex>
          {markA !== null && <Text size="2">
            A {theaterTime(markA)}{loop && !loop.cueId ? ' · B ' + theaterTime(loop.endMs) + ' · AB 复读' : ''}
          </Text>}
          {loopError && <Text role="alert" size="2" color="red">{loopError}</Text>}
          <Flex gap="3" wrap="wrap">
            <SelectControl value={caption} options={captionOptions.map(value => ({ value, label: captionLabels[value] }))}
              ariaLabel="画面字幕" label="字幕" onValueChange={value => setCaption(value as CaptionMode)} />
            <SelectControl value={rate} options={['0.5', '0.75', '1', '1.25', '1.5', '2'].map(value => ({ value, label: value + ' 倍' }))}
              ariaLabel="播放速度" label="倍速" onValueChange={value => {
                if (audioRef.current) audioRef.current.playbackRate = Number(value)
                setRate(value)
              }} />
          </Flex>
        </Flex>
      </StickerCard>

      <StickerCard as="section" aria-label="字幕列表" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Flex direction="column" gap="3">
          <Heading as="h2" size="4">字幕列表</Heading>
          {canEdit && <TheaterSubtitleEditor filmId={film.id} userId={userId} tracks={tracks} cue={editingCue}
            closeEditor={() => setEditingCue(null)} onTracksChange={onTracksChange} />}
          <TextField.Root placeholder="搜索中英文字幕" aria-label="搜索中英文字幕" value={query}
            onChange={event => { setQuery(event.target.value); setPageOverride(null) }} />
          {!filtered.length && <Text size="2" color="gray">{queryText ? '没有匹配的字幕。' : '没有可显示的字幕。'}</Text>}
          <ul className="grid max-h-[32rem] min-w-0 gap-2 overflow-y-auto p-0.5">
            {filtered.slice(page * pageSize, (page + 1) * pageSize).map(cue => (
              <StickerCard as="li" key={cue.id} size="sm" radius="md" elevation="flat"
                tone={current?.id === cue.id ? 'accent' : 'white'}>
                <Flex gap="2" align="start">
                  <Button variant="soft" type="button" aria-current={current?.id === cue.id ? 'true' : undefined}
                    aria-label={'跳到 ' + theaterTime(cue.startMs) + '，' + (cue.en ?? cue.zh)}
                    onClick={() => chooseCue(cue)}>{theaterTime(cue.startMs)}</Button>
                  <div className="min-w-0 whitespace-pre-wrap break-words">
                    {cue.en && <Text as="div" size="2" weight="medium">{cue.en}</Text>}
                    {cue.zh && <Text as="div" size="2" color="gray">{cue.zh}</Text>}
                  </div>
                  {canEdit && <Button type="button" size="1" variant="ghost" className="ml-auto shrink-0"
                    aria-label={'编辑 ' + theaterTime(cue.startMs) + ' 的台词'}
                    onClick={() => { audioRef.current?.pause(); setEditingCue(cue) }}>编辑台词</Button>}
                </Flex>
              </StickerCard>
            ))}
          </ul>
          {maxPage > 0 && <Flex align="center" gap="2" wrap="wrap">
            <Button variant="soft" disabled={page === 0} onClick={() => setPageOverride(page - 1)}>上一页</Button>
            <Text size="2" color="gray">{page + 1} / {maxPage + 1}</Text>
            <Button variant="soft" disabled={page === maxPage} onClick={() => setPageOverride(page + 1)}>下一页</Button>
            {(pageOverride !== null || queryText) && <Button variant="ghost"
              onClick={() => { setQuery(''); setPageOverride(null) }}>定位播放位置</Button>}
          </Flex>}
        </Flex>
      </StickerCard>
      <TheaterLearningPanel userId={userId} filmId={film.id} cue={learningCue}
        onPause={() => audioRef.current?.pause()} onReview={review} />
    </div>
  )
}
