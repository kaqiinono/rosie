'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import type Hls from 'hls.js'
import { supabase, useAuth } from '@rosie/core'
import { usePlaylistPlayer } from '@rosie/player'
import {
  ArrowDownToLine, ArrowUpToLine, ChevronDown, Eye, EyeOff, LoadingOverlay, PageBreadcrumb, Pencil, RotateCw,
  Scissors, StickerCard, Trash2, Volume2,
} from '@rosie/ui'
import { Button, DropdownMenu, Flex, Heading, IconButton, Text, TextField } from '@rosie/ui/themes'
import { requestTheater } from '@/lib/theater/client'
import {
  activeTheaterCue, canApplyTheaterCueAction, cueIndexAtOrBefore, mergeTheaterTracks, subtitleTimestamp, theaterTime,
} from '@/lib/theater/subtitle-timeline'
import { theaterInternalAudioUnavailable, theaterLanguageLabel, type TheaterCue,
  type TheaterPlaybackFilm, type TheaterStudyItem, type TheaterSubtitleSelection, type TheaterSubtitles } from '@/lib/theater/types'
import { isTheaterSubtitleNotice, matchesTheaterStudyCue, savedTheaterCueEnd, useTheaterLearning } from './TheaterLearningPanel'
import TheaterSubtitleEditor, { type SubtitleListEditing } from './TheaterSubtitleEditor'
import TheaterSubtitleTimeline, { type SubtitlePositionRequest } from './TheaterSubtitleTimeline'
import { useTheaterProgress } from './useTheaterProgress'
import { useTheaterExternalAudio } from './useTheaterExternalAudio'

type CaptionMode = 'both' | 'en' | 'zh' | 'off'
type Loop = { startMs: number; endMs: number; cueId?: string }
type OpenFilm = TheaterSubtitles & { film: TheaterPlaybackFilm }
type PlaybackSource = 'original' | 'hls' | 'copy'
const audioModes = [
  { value: 'auto', label: '自动（内置优先）' },
  { value: 'internal', label: '内置音轨' },
  { value: 'external', label: '外部音轨' },
] as const
type AudioMode = (typeof audioModes)[number]['value']
const captionLabels = { both: '双语', en: '英文', zh: '中文', off: '关闭' }
const captionModes = ['both', 'en', 'zh'] as const
const subtitleActions = [
  { action: 'edit', label: '编辑台词', Icon: Pencil },
  { action: 'split', label: '拆成两句', Icon: Scissors },
  { action: 'previous', label: '与上一句合并', Icon: ArrowUpToLine },
  { action: 'next', label: '与下一句合并', Icon: ArrowDownToLine },
  { action: 'remove', label: '删除此句', Icon: Trash2 },
] as const
const playbackRates = ['0.5', '0.75', '0.8', '1', '1.25', '1.5', '2']
const dialogueWindowSize = 5

function CueActionStrip({ label, cells, children }: { label: string; cells: number; children: ReactNode }) {
  return <Flex direction="row" align="center" wrap="nowrap" gap="1" role="group" aria-label={label}
    style={{ width: `${cells * 2 + (cells - 1) * 0.25}rem` }}
    className="ml-auto min-w-0 max-w-full [&>span]:min-w-0 [&>span]:flex-1
      [&_button]:m-0! [&_button]:inline-flex! [&_button]:h-7! [&_button]:w-full! [&_button]:min-w-0!
      [&_button]:items-center! [&_button]:justify-center! [&_button]:rounded-none! [&_button]:p-0!
      [&_button:focus-visible]:-outline-offset-2!">
    {children}
  </Flex>
}

function vttLine(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n{2,}/g, '\n')
}

function continuesSubtitle(cue: TheaterCue, previous: TheaterCue | undefined) {
  if (!previous?.en || !cue.en) return false
  const gap = cue.startMs - previous.endMs
  return gap >= -250 && gap <= 1000 && /[,，;；:：—-]$/.test(previous.en.trimEnd())
}

function buildCaptionVtt(cues: TheaterCue[], showBoth: boolean) {
  const captions: Partial<Record<typeof captionModes[number], string>> = {}
  for (const mode of captionModes) {
    if (mode === 'both' && !showBoth) continue
    const lines = cues.flatMap(cue => {
      const text = mode === 'both' ? [cue.en, cue.zh].filter(Boolean).join('\n') : cue[mode]
      return text ? [subtitleTimestamp(cue.startMs) + ' --> ' + subtitleTimestamp(cue.endMs) + '\n' + vttLine(text)] : []
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
          requestTheater<TheaterPlaybackFilm>(userId, '/api/theater?filmId=' + filmId, { signal }),
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
      {!resource && !error && <div className="relative flex min-h-48 flex-1 flex-col"><LoadingOverlay visible placement="content" /></div>}
      {error && <StickerCard><Flex gap="3" align="center" wrap="wrap">
        <Text role="alert">{error}</Text>
        <Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>重试</Button>
      </Flex></StickerCard>}
      {resource && <FilmWorkspace resource={resource} userId={userId}
        onTracksChange={subtitles => setResource(previous => previous && { ...previous, ...subtitles })}
        onReload={() => { setResource(null); setAttempt(value => value + 1) }} />}
    </main>
  )
}

function FilmWorkspace({ resource, userId, onReload, onTracksChange }: {
  resource: OpenFilm
  userId: string
  onReload: () => void
  onTracksChange: (subtitles: TheaterSubtitles) => void
}) {
  const { film, tracks, canEdit, editor } = resource
  const cues = useMemo(() => mergeTheaterTracks(tracks), [tracks])
  const [editingCue, setEditingCue] = useState<TheaterSubtitleSelection | null>(null)
  const [translationCueId, setTranslationCueId] = useState<string | null>(null)
  const { audioRef, notifyPlay, notifyPause } = usePlaylistPlayer()
  const { resume, message, reading, reload, save } = useTheaterProgress(userId, film.id)
  const { recordsButton, records, feedback, cueText, cueDetails, favoriteButton } = useTheaterLearning({
    userId, filmId: film.id, onPause: () => audioRef.current?.pause(), onReview: review,
  })
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState('1')
  const [caption, setCaption] = useState<CaptionMode>(film.languages.length === 2 ? 'both' : film.languages[0] ?? 'off')
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState<Loop | null>(null)
  const [markA, setMarkA] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [subtitlePosition, setSubtitlePosition] = useState<SubtitlePositionRequest | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [audioMode, setAudioMode] = useState<AudioMode>('auto')
  const [unavailableAudio, setUnavailableAudio] = useState<PlaybackSource>()
  const [isBuffering, setIsBuffering] = useState(true)
  const [loopError, setLoopError] = useState('')
  const hasPlayback = useRef(false)
  const lastSaveAt = useRef(0)
  const animation = useRef<number>(0)
  const loopRef = useRef<Loop | null>(null)
  const previewEnd = useRef<number | null>(null)
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
  const audioRequested = Boolean(film.hasExternalAudio && source && !reading && !videoError &&
    (audioMode === 'external' || (audioMode === 'auto' && unavailableAudio === source)))
  const external = useTheaterExternalAudio(audioRef, audioRequested, source)
  const showBothCaptions = film.languages.length === 2
  const captions = useMemo(() => buildCaptionVtt(cues, showBothCaptions), [cues, showBothCaptions])
  const current = useMemo(() => activeTheaterCue(cues, time), [cues, time])
  const queryText = query.trim().toLowerCase()
  const filtered = useMemo(() => queryText
    ? cues.filter(cue => [cue.en, cue.zh].some(value => value?.toLowerCase().includes(queryText)))
    : cues, [cues, queryText])
  const atOrBefore = cueIndexAtOrBefore(cues, time)
  const dialogueCue = current ?? cues[atOrBefore]
  const dialogueIndex = dialogueCue === cues[atOrBefore] ? atOrBefore : cues.indexOf(dialogueCue)
  const dialogueNotice = dialogueCue && isTheaterSubtitleNotice(dialogueCue)
  const highlightedCueId = dialogueNotice ? undefined : dialogueCue?.id
  const dialogueStart = Math.max(0, Math.min(dialogueIndex - Math.floor(dialogueWindowSize / 2), cues.length - dialogueWindowSize))
  const dialogueCues = dialogueCue ? cues.slice(dialogueStart, dialogueStart + dialogueWindowSize) : []
  const showTranslation = dialogueCue?.id === translationCueId
  const dialogueLooping = Boolean(dialogueCue && loop?.cueId === dialogueCue.id)
  const repeatCue = dialogueCue
  const captionOptions = [...captionModes.filter(mode => mode === 'both'
    ? film.languages.length === 2 : film.languages.includes(mode)), 'off' as const]

  const setPlaybackLoop = useCallback((value: Loop | null) => {
    loopRef.current = value
    setLoop(value)
  }, [])

  const positionMs = (video: HTMLVideoElement) => Math.round(video.currentTime * 1000)
  function inspectInternalAudio(video: HTMLVideoElement) {
    if (!film.hasExternalAudio || !source) return
    const codecs = source === 'copy' ? film.playbackAudioCodecs : source === 'original' ? film.videoAudioCodecs : null
    const tracks = (video as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
    const trackCount = video.readyState >= 2 ? tracks?.length : undefined
    const unavailable = theaterInternalAudioUnavailable(codecs, trackCount, type => video.canPlayType(type))
    setUnavailableAudio(unavailable ? source : undefined)
  }

  const failPlaybackSource = useCallback(() => {
    previewEnd.current = null
    setPlaying(false)
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
    const end = previewEnd.current
    if (!video.paused && end !== null && position >= end) {
      previewEnd.current = null
      video.pause()
      seek(end)
      return
    }
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
    setPlaying(true)
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
    setPlaying(false)
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
    seek(cue.startMs)
  }

  function navigateCue(direction: -1 | 1) {
    const target = cues[Math.max(0, atOrBefore + direction)]
    if (target) chooseCue(target)
  }

  function loopCue(cue: TheaterCue) {
    loopRange(cue.startMs, cue.endMs, cue.id)
  }

  function loopRange(startMs: number, finishMs: number, cueId?: string) {
    const video = audioRef.current
    if (!video || video.readyState < 1 || !Number.isFinite(video.duration)) return
    const endMs = Math.min(finishMs, Math.round(video.duration * 1000))
    if (endMs <= startMs) { setLoopError('这句字幕超出影片时长。'); return }
    setLoopError('')
    setMarkA(null)
    setPlaybackLoop({ startMs, endMs, cueId })
    seek(startMs)
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

  function locateSubtitle(positionMs: number) {
    setQuery('')
    setSubtitlePosition({ positionMs })
  }

  function review(item: TheaterStudyItem) {
    const cue = cues.find(value => matchesTheaterStudyCue(item, value))
    const end = savedTheaterCueEnd(item)
    locateSubtitle(cue?.startMs ?? item.position_ms)
    if (cue) loopCue(cue)
    else if (end !== undefined) loopRange(item.position_ms, end)
    else {
      setPlaybackLoop(null)
      seek(item.position_ms)
    }
  }

  function pausePreview() {
    previewEnd.current = null
    audioRef.current?.pause()
  }

  function openSubtitleEditor(selection: TheaterSubtitleSelection) {
    pausePreview()
    setPlaybackLoop(null)
    setMarkA(null)
    setEditingCue(selection)
  }

  async function previewSubtitle(startMs: number, endMs: number) {
    const video = audioRef.current
    if (!video || video.readyState < 1 || !Number.isFinite(video.duration)) return false
    const end = Math.min(endMs, Math.floor(video.duration * 1000))
    if (end <= startMs) return false
    previewEnd.current = end
    seek(startMs)
    try {
      await video.play()
      return true
    } catch {
      if (previewEnd.current === end) previewEnd.current = null
      return false
    }
  }

  const videoDuration = audioRef.current?.duration
  const editorDuration = typeof videoDuration === 'number' && Number.isFinite(videoDuration)
    ? Math.floor(videoDuration * 1000) : null

  function changeRate(value: string) {
    if (audioRef.current) audioRef.current.playbackRate = Number(value)
    setRate(value)
  }

  function renderSubtitleList(editing?: SubtitleListEditing) {
    return <>
      <TextField.Root placeholder="搜索中英文字幕" aria-label="搜索中英文字幕" value={query}
        onChange={event => { setQuery(event.target.value); setSubtitlePosition(null) }} />
      {filtered.length ? <TheaterSubtitleTimeline key={queryText} cues={filtered} positionRequest={subtitlePosition}>
        {(cue, previous) => {
          const stamp = theaterTime(cue.startMs)
          const highlighted = highlightedCueId === cue.id
          const looping = loop?.cueId === cue.id
          const continuation = !queryText && continuesSubtitle(cue, previous)
          const language = cue.en ? 'en' : 'zh'
          const index = cue.sourceCues?.[language]?.[0]
          const step = editor?.precision[language]
          return (
            <li key={cue.id} aria-current={highlighted ? 'true' : undefined}
              className={`min-w-0 border-t px-1.5 pb-1 first:border-t-transparent ${continuation
                ? 'border-t-transparent pt-0.5' : 'border-kid-line pt-1'} ${highlighted ? 'rounded-lg bg-[var(--accent-3)]' : ''}`}>
              <Flex direction="row" gap="1" align="center" wrap="nowrap" className="mb-0.5">
                <Button type="button" size="1" variant="ghost" color={highlighted ? undefined : 'gray'}
                  className="m-0! h-6! shrink-0 px-0.5! py-0! tabular-nums"
                  aria-label={'跳到 ' + stamp + '，' + (cue.en ?? cue.zh)}
                  onClick={() => chooseCue(cue)}>{stamp.padStart(5, '0')}</Button>
                <CueActionStrip label={stamp + ' 的字幕操作'} cells={editing ? 7 : 2}>
                  <Flex as="span" align="center" justify="center">
                    <IconButton type="button" size="1" variant={looping ? 'soft' : 'ghost'}
                      color={looping ? undefined : 'gray'} title="单句复读" data-soft-outline="none"
                      aria-label={`复读 ${stamp} 的台词`} aria-pressed={looping} disabled={reading || videoError}
                      onClick={() => looping ? setPlaybackLoop(null) : loopCue(cue)}>
                      <RotateCw size={15} aria-hidden="true" />
                    </IconButton>
                  </Flex>
                  <Flex as="span" align="center" justify="center">{favoriteButton(cue)}</Flex>
                  {editing && subtitleActions.map(({ action, label, Icon }) => <Flex as="span" key={action}
                    align="center" justify="center">
                    <IconButton type="button" size="1" color={action === 'remove' ? 'red' : 'gray'}
                      variant="ghost" title={action === 'edit' ? label : theaterLanguageLabel[language] + ' · ' + label}
                      aria-label={stamp + ' · ' + label} disabled={editing.locked || index === undefined ||
                        !step || !canApplyTheaterCueAction(tracks[language], index, step, action)}
                      onClick={() => {
                        if (index === undefined) return
                        if (action === 'edit') openSubtitleEditor(cue)
                        else editing.applyShortcut(language, index, action)
                      }}>
                      <Icon size={15} aria-hidden="true" />
                    </IconButton>
                  </Flex>)}
                </CueActionStrip>
              </Flex>
              <div className="min-w-0 whitespace-pre-wrap wrap-break-word">
                {cueText(cue)}
              </div>
              {cueDetails(cue)}
            </li>
          )
        }}
      </TheaterSubtitleTimeline>
        : <Text size="2" color="gray">{queryText ? '没有匹配的字幕。' : '没有可显示的字幕。'}</Text>}
    </>
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <StickerCard as="section" aria-label="影片播放器" size="sm" className="min-w-0 lg:col-start-1 lg:row-start-1">
        <Flex direction="column" gap="3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {!reading && <video key={source} ref={audioRef}
              src={source === 'hls' ? undefined : mediaRoot + '/video' + (source === 'copy' ? '?copy=1' : '')} controls playsInline
              preload="metadata" aria-label={film.title} className="h-full w-full"
              onPlay={play} onPause={pause}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={event => {
                setIsBuffering(false)
                inspectInternalAudio(event.currentTarget)
              }}
              onLoadedData={event => inspectInternalAudio(event.currentTarget)}
              onTimeUpdate={event => tick(event.currentTarget)}
              onLoadedMetadata={event => {
                setIsBuffering(false)
                inspectInternalAudio(event.currentTarget)
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
            {external.active && <audio key={'external:' + source} ref={external.externalRef} src={mediaRoot + '/audio'} preload="metadata"
              onError={external.onError} onVolumeChange={event => external.onVolumeChange(event.currentTarget)} />}
            {reading && <LoadingOverlay visible placement="content" />}
          </div>
          {isBuffering && <Text role="status" size="2" color="gray">正在缓冲…</Text>}
          {external.active && external.blocked && <Button size="1" variant="soft" className="self-start"
            onClick={external.retry}>播放外部音轨</Button>}
          {audioRequested && external.failed && <Flex gap="2" wrap="wrap" align="center">
            <Text role="status" size="2">外部音轨无法播放，已切回内置音轨。</Text>
            <Button size="1" variant="soft" onClick={external.retry}>重试外部音轨</Button>
          </Flex>}
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
          <StickerCard as="section" aria-label="当前台词" variant="soft" tone="paper" radius="md" size="md" className="min-w-0">
            <Flex direction="row" gap="2" align="center" justify="between" wrap="nowrap">
              <Flex gap="2" align="center" className="shrink-0 whitespace-nowrap">
                <Volume2 size={17} aria-hidden="true"
                  className={playing && !isBuffering && current?.id === dialogueCue?.id && dialogueCue
                    ? 'text-[var(--accent-11)]' : 'text-text-muted'} />
                <Heading as="h2" size="2">当前台词</Heading>
              </Flex>
              {dialogueCue && <CueActionStrip label="当前台词操作" cells={4}>
                <Flex as="span" align="center" justify="center">
                  {!dialogueNotice && dialogueCue.en && dialogueCue.zh && <IconButton type="button" size="1" color="gray"
                    variant={showTranslation ? 'soft' : 'ghost'} aria-pressed={showTranslation} data-soft-outline="none"
                    title={showTranslation ? '隐藏译文' : '显示译文'} aria-label="显示当前句译文"
                    onClick={() => setTranslationCueId(showTranslation ? null : dialogueCue.id)}>
                    {showTranslation ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  </IconButton>}
                </Flex>
                <Flex as="span" align="center" justify="center">
                  {!dialogueNotice && <IconButton type="button" size="1" variant={dialogueLooping ? 'soft' : 'ghost'}
                    color={dialogueLooping ? undefined : 'gray'} title="单句复读" data-soft-outline="none"
                    aria-label="复读当前台词" aria-pressed={dialogueLooping} disabled={reading || videoError}
                    onClick={() => dialogueLooping ? setPlaybackLoop(null) : loopCue(dialogueCue)}>
                    <RotateCw size={15} aria-hidden="true" />
                  </IconButton>}
                </Flex>
                <Flex as="span" align="center" justify="center">
                  <Button type="button" size="1" variant="ghost" color="gray" title="切换倍速"
                    className="text-xs! leading-none! font-bold tabular-nums"
                    aria-label={`当前 ${rate} 倍，切换到 ${rate === '0.8' ? '1' : '0.8'} 倍`}
                    onClick={() => changeRate(rate === '0.8' ? '1' : '0.8')}>
                    {rate === '1' ? '1.0' : rate}×
                  </Button>
                </Flex>
                <Flex as="span" align="center" justify="center">{favoriteButton(dialogueCue)}</Flex>
              </CueActionStrip>}
            </Flex>
            {dialogueCue ? <ul className="mt-2 grid min-w-0 gap-1">
              {dialogueCues.map(cue => {
                const isCurrent = cue.id === dialogueCue.id
                const highlighted = highlightedCueId === cue.id
                const stamp = theaterTime(cue.startMs)
                const details = cueDetails(cue, 'current')
                return (
                  <li key={cue.id} aria-current={isCurrent ? 'true' : undefined}
                    className={`min-w-0 border-l-4 px-2 py-0.5 ${highlighted
                      ? 'rounded-r-lg border-l-[var(--accent-9)] bg-[var(--accent-3)]'
                      : 'border-transparent text-text-secondary'}`}>
                    <Flex direction="row" align="start" gap="2">
                      <Button type="button" size="1" variant="soft" radius="medium" color={highlighted ? undefined : 'gray'}
                        style={{ width: '3.625rem', flex: 'none' }}
                        className={`h-6! whitespace-nowrap px-1! tabular-nums ${highlighted ? 'mt-1' : ''}`}
                        aria-label={`跳到 ${stamp} 的台词`} disabled={reading || videoError}
                        onClick={() => chooseCue(cue)}>{stamp}</Button>
                      <div className="min-w-0 flex-1 space-y-1 py-0.5 whitespace-pre-wrap wrap-break-word">
                        {cueText(cue, { surface: 'current', highlighted, showTranslation: highlighted && showTranslation })}
                      </div>
                    </Flex>
                    {details}
                  </li>
                )
              })}
            </ul> : <Text as="div" size="2" color="gray" className="mt-2">当前播放位置暂无台词。</Text>}
          </StickerCard>
        </Flex>
      </StickerCard>

      <StickerCard as="section" aria-label="字幕列表" size="sm" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Flex direction="column" gap="2">
          <Flex gap="2" align="center" justify="between" wrap="wrap">
            <Heading as="h2" size="4">字幕列表</Heading>
            <Flex gap="2" align="center" wrap="wrap">
              {cues.length > 0 && <Button type="button" size="1" variant="soft" color="gray"
                onClick={() => locateSubtitle((current ?? dialogueCue)?.startMs ?? time)}>定位播放位置</Button>}
              {recordsButton}
            </Flex>
          </Flex>
          {feedback}
          {records}
          {canEdit && editor ? <TheaterSubtitleEditor filmId={film.id} userId={userId} tracks={tracks}
            selection={editingCue} editor={editor} openInsert={() => openSubtitleEditor('insert')}
            playback={{ time, duration: editorDuration, position: () => audioRef.current ? positionMs(audioRef.current) : time,
              preview: previewSubtitle, pause: pausePreview, seek }}
            closeEditor={() => { pausePreview(); setEditingCue(null) }} onTracksChange={subtitles => {
              if (loopRef.current?.cueId) setPlaybackLoop(null)
              onTracksChange(subtitles)
            }} renderList={renderSubtitleList} /> : renderSubtitleList()}
        </Flex>
      </StickerCard>

      <StickerCard as="section" aria-label="播放工具" size="sm"
        className="sticky bottom-[env(safe-area-inset-bottom)] z-10 min-w-0 lg:static lg:col-start-1 lg:row-start-2">
        <Flex gap="2" align="center" className="overflow-x-auto p-1 [&>*]:shrink-0">
          <IconButton type="button" size="2" variant="soft" aria-label="上一句" title="上一句"
            disabled={!cues.length || reading || videoError} onClick={() => navigateCue(-1)}>
            <ChevronDown size={16} aria-hidden="true" className="rotate-90" />
          </IconButton>
          <Button type="button" size="2" disabled={reading || videoError} onClick={() => {
            const video = audioRef.current
            if (!video) return
            setLoopError('')
            if (video.paused) void video.play().catch(() => setLoopError('请点击画面中的播放按钮。'))
            else video.pause()
          }}>{playing ? '暂停' : '播放'}</Button>
          <IconButton type="button" size="2" variant="soft" aria-label="下一句" title="下一句"
            disabled={atOrBefore >= cues.length - 1 || reading || videoError} onClick={() => navigateCue(1)}>
            <ChevronDown size={16} aria-hidden="true" className="-rotate-90" />
          </IconButton>
          <Button type="button" size="2" variant={loop?.cueId ? 'solid' : 'soft'}
            aria-pressed={Boolean(loop?.cueId)} disabled={!repeatCue || reading || videoError} onClick={() => {
              if (loop?.cueId) setPlaybackLoop(null)
              else if (repeatCue) loopCue(repeatCue)
            }}>单句复读</Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button type="button" size="2" variant={markA === null ? 'soft' : 'solid'} aria-label="AB 复读">
                AB
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content size="1" align="end">
              <DropdownMenu.Item disabled={reading || videoError} onSelect={() => {
                if (!audioRef.current) return
                setPlaybackLoop(null)
                setLoopError('')
                setMarkA(positionMs(audioRef.current))
              }}>设置 A 点</DropdownMenu.Item>
              <DropdownMenu.Item disabled={markA === null || reading || videoError} onSelect={setB}>设置 B 点</DropdownMenu.Item>
              {markA !== null && <DropdownMenu.Item onSelect={() => {
                setPlaybackLoop(null)
                setMarkA(null)
                setLoopError('')
              }}>清除 AB</DropdownMenu.Item>}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button type="button" size="2" variant="soft" aria-label="播放设置">设置</Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content size="1" align="end">
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>画面字幕 · {captionLabels[caption]}</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.RadioGroup value={caption} onValueChange={value => setCaption(value as CaptionMode)}>
                    {captionOptions.map(value => <DropdownMenu.RadioItem key={value} value={value}>{captionLabels[value]}</DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>倍速 · {rate} 倍</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.RadioGroup value={rate} onValueChange={changeRate}>
                    {playbackRates.map(value => <DropdownMenu.RadioItem key={value} value={value}>{value} 倍</DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              {film.hasExternalAudio && <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>音轨</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.RadioGroup value={audioMode} onValueChange={value => {
                    setAudioMode(value as AudioMode)
                    external.retry()
                  }}>
                    {audioModes.map(mode => <DropdownMenu.RadioItem key={mode.value} value={mode.value}>{mode.label}</DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>}
              {external.active && <DropdownMenu.Item onSelect={external.toggleMute}>
                {external.muted ? '取消外部音轨静音' : '静音外部音轨'}
              </DropdownMenu.Item>}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
        {markA !== null && <Text as="div" size="1" color="gray" className="px-1 tabular-nums">
          A {theaterTime(markA)}{loop && !loop.cueId ? ' · B ' + theaterTime(loop.endMs) + ' · AB 复读' : ''}
        </Text>}
        {loopError && <Text as="div" role="alert" size="2" color="red" className="px-1">{loopError}</Text>}
      </StickerCard>
    </div>
  )
}
