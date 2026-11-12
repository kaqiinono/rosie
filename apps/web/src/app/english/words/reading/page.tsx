'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { useAuth, supabase, useBaiduMediaError } from '@rosie/core'
import { useWeeklyPlan } from '@rosie/english'
import {
  useReadingPassageMedia,
  useBaiduReadingAudio,
  lessonAudioUrl,
  baiduReadingAudioUrl,
} from '@rosie/english'
import { usePlaylistPlayer } from '@rosie/player'
import { useWordsContext } from '@rosie/english'
import { PlayerDock } from '@rosie/player'
import { parseFocusLessonKey, readingPassages } from '@rosie/english'
import { READING_AUDIO_BUCKET, readingPassageAudioPath } from '@rosie/english'
import { wordKey } from '@rosie/english'
import { getWordMasteryLevel } from '@rosie/core'
import { type PlayerTrack } from '@rosie/player'
import { StoryShelf } from '@rosie/english'
import { Button, IconButton, SegmentedControl } from '@rosie/ui/themes'

export default function ReadingIndexPage() {
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useWeeklyPlan(user)
  const { vocab, masteryMap, selStage, setSelStage } = useWordsContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasAudio } = useReadingPassageMedia(user)
  const {
    hasAudio: hasBaiduAudio,
    isLoading: loadingBaidu,
    error: baiduError,
  } = useBaiduReadingAudio(user)
  const hasPlayableAudio = useCallback(
    (key: string) =>
      hasBaiduAudio(key + '#narration') || hasBaiduAudio(key) || (!loadingBaidu && hasAudio(key)),
    [hasBaiduAudio, hasAudio, loadingBaidu],
  )
  const player = usePlaylistPlayer()
  const playbackError = useBaiduMediaError(player.audioRef)
  const collection = searchParams.get('collection') === 'story' ? 'story' : 'houhai'
  const houhaiStages = useMemo(
    () =>
      [...new Set(readingPassages.map((passage) => passage.stage))]
        .filter((stage) => stage === '4A' || stage === '5A')
        .sort((a, b) => b.localeCompare(a)),
    [],
  )
  const requestedVolume = searchParams.get('volume')?.toUpperCase() ?? null
  const selectedVolume =
    houhaiStages.find((stage) => stage === requestedVolume) ?? houhaiStages[0]

  useEffect(() => {
    if (collection === 'houhai' && selectedVolume && selectedVolume !== selStage) {
      setSelStage(selectedVolume)
    }
  }, [collection, selStage, selectedVolume, setSelStage])

  // 选中集（用于"播放选中"）。切教材后 audiobookKeys 会变，下面 selectedKeys 自动丢掉跨册项。
  const [queueKeys, setQueueKeys] = useState<string[]>([])
  const [savingCurrentLesson, setSavingCurrentLesson] = useState(false)
  const [currentLessonError, setCurrentLessonError] = useState<string | null>(null)
  const currentLessonKey =
    typeof user?.user_metadata?.reading_current_lesson === 'string'
      ? user.user_metadata.reading_current_lesson
      : null

  const markCurrentLesson = async (key: string) => {
    if (!user || savingCurrentLesson || key === currentLessonKey) return
    setSavingCurrentLesson(true)
    setCurrentLessonError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { reading_current_lesson: key },
      })
      if (error) throw error
    } catch {
      setCurrentLessonError('当前课保存失败，请重试。')
    } finally {
      setSavingCurrentLesson(false)
    }
  }

  const focusKey = weeklyPlan?.focusLessonKey ?? null
  const parsedFocus = useMemo(() => (focusKey ? parseFocusLessonKey(focusKey) : null), [focusKey])

  const stagePassages = useMemo(
    () => (selectedVolume ? readingPassages.filter((p) => p.stage === selectedVolume) : []),
    [selectedVolume],
  )

  const cards = useMemo(() => {
    const num = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? '0', 10)
    const sorted = [...stagePassages].sort((a, b) => {
      if (a.unit !== b.unit) return num(a.unit) - num(b.unit)
      return num(a.lesson) - num(b.lesson)
    })
    const currentIndex = sorted.findIndex((p) => p.key === currentLessonKey)
    const ordered =
      currentIndex >= 0 ? [...sorted.slice(currentIndex), ...sorted.slice(0, currentIndex)] : sorted
    return ordered.map((p) => {
      const lessonWords = vocab.filter((w) => w.unit === p.unit && w.lesson === p.lesson)
      const mastered = lessonWords.reduce((n, w) => {
        const info = masteryMap[wordKey(w)]
        return n + (info && getWordMasteryLevel(info.correct) >= 3 ? 1 : 0)
      }, 0)
      const isFocus =
        !!parsedFocus &&
        (!parsedFocus.stage || parsedFocus.stage === p.stage) &&
        parsedFocus.unit === p.unit &&
        parsedFocus.lesson === p.lesson
      return {
        passage: p,
        wordCount: lessonWords.length,
        masteredCount: mastered,
        glossaryCount: p.glossary?.length ?? 0,
        paragraphCount: p.paragraphs.length,
        isFocus,
      }
    })
  }, [stagePassages, vocab, masteryMap, parsedFocus, currentLessonKey])

  // 直接从 reading 自己的课文构建播放曲目（reading_passage_media / 'reading' bucket），
  // 按 passage key 建索引。不依赖 audio 模块的收藏夹聚合，连播留在 reading 自己范围内。
  const trackByKey = useMemo(() => {
    const map = new Map<string, PlayerTrack>()
    for (const p of stagePassages) {
      if (!hasPlayableAudio(p.key)) continue
      let url: string
      if (hasBaiduAudio(p.key + '#narration')) url = lessonAudioUrl(p.key, 'narration')
      else if (hasBaiduAudio(p.key)) url = baiduReadingAudioUrl(p.key)
      else
        url = supabase.storage
          .from(READING_AUDIO_BUCKET)
          .getPublicUrl(readingPassageAudioPath(p.key)).data.publicUrl
      map.set(p.key, {
        url,
        label: p.title,
        refLink: `/english/words/reading/${p.key}`,
        mediaType: 'audio',
        source: null,
      })
    }
    return map
  }, [stagePassages, hasPlayableAudio, hasBaiduAudio])

  const audiobookKeys = useMemo(
    () =>
      cards
        .filter(({ passage }) => hasPlayableAudio(passage.key))
        .map(({ passage }) => passage.key),
    [cards, hasPlayableAudio],
  )

  // Drop selection that belongs to another textbook after a stage switch.
  const selectedKeys = queueKeys.filter((k) => audiobookKeys.includes(k))
  const hasSelection = selectedKeys.length > 0

  const toggleQueueMember = useCallback((key: string) => {
    setQueueKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const playKeys = useCallback(
    (keys: string[]) => {
      const tracks = keys
        .map((k) => trackByKey.get(k))
        .filter((t): t is PlayerTrack => t !== undefined)
      if (tracks.length) player.play(tracks)
    },
    [trackByKey, player],
  )

  const current = player.current

  if (collection === 'story') return <StoryShelf />

  return (
    <main
      className="font-nunito relative z-[1] mx-auto w-full max-w-[1280px] px-3 pt-6 pb-32 md:px-4"
      style={{ colorScheme: 'light' }}
    >
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="font-fredoka text-xl font-bold text-[var(--wm-text)] sm:text-2xl">
            📚 厚海阅读
          </h1>
          {houhaiStages.length > 0 && (
            <SegmentedControl.Root
              aria-label="厚海阅读册别"
              size="3"
              value={selectedVolume}
              onValueChange={(volume) => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('volume', volume)
                router.replace(`/english/words/reading?${params}`, { scroll: false })
              }}
            >
              {houhaiStages.map((stage) => (
                <SegmentedControl.Item key={stage} value={stage}>
                  {stage}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            disabled={audiobookKeys.length === 0}
            onClick={() => playKeys(hasSelection ? selectedKeys : audiobookKeys)}
            variant="solid"
            color="amber"
            size="2"
          >
            ▶{' '}
            {audiobookKeys.length === 0
              ? '暂无音频'
              : hasSelection
                ? `播放选中 ${selectedKeys.length}`
                : `播放全部 ${audiobookKeys.length}`}
          </Button>
          {player.queue.length > 0 && (
            <Button type="button" onClick={player.stop} variant="outline" color="orange" size="2">
              停止
            </Button>
          )}
        </div>
      </div>
      {isLoading && <div className="mb-3 text-[11px] text-[var(--wm-text-dim)]">载入多日计划…</div>}
      {currentLessonError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {currentLessonError}
        </p>
      )}

      {cards.length === 0 ? (
        <div className="ring-kid-line rounded-2xl bg-white p-8 text-center ring-1">
          <div className="mb-2 text-4xl">📭</div>
          <div className="font-bold text-gray-800">暂无厚海课文</div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(
            ({ passage: p, wordCount, masteredCount, glossaryCount, paragraphCount, isFocus }) => {
              const passageHasAudio = hasPlayableAudio(p.key)
              const track = trackByKey.get(p.key)
              const queuePos = queueKeys.indexOf(p.key)
              const inQueue = queuePos !== -1
              const isPlayingInQueue =
                !!current?.refLink && current.refLink === `/english/words/reading/${p.key}`
              return (
                <li
                  key={p.key}
                  className={clsx(
                    'hover:shadow-sticker flex items-stretch gap-3 rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 sm:p-5',
                    p.key === currentLessonKey
                      ? 'shadow-sticker bg-sky-50 ring-2 ring-sky-500'
                      : isPlayingInQueue
                        ? 'shadow-sticker-sm bg-white ring-2 ring-orange-400'
                        : 'ring-kid-line bg-white hover:ring-orange-300',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/english/words/reading/${p.key}`}
                        className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 no-underline ring-1 ring-orange-200 transition hover:bg-orange-100"
                      >
                        📖 {p.unit} · {p.lesson}
                      </Link>
                      {isFocus && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-sky-300">
                          ⭐ 本周精读
                        </span>
                      )}
                      {isPlayingInQueue && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-300">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                          播放中
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/english/words/reading/${p.key}`}
                      className="group block min-w-0 no-underline"
                    >
                      <h2 className="font-fredoka text-lg font-bold text-gray-900 group-hover:text-orange-700 xl:text-xl">
                        {p.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-600">
                        <span>📄 {paragraphCount} 段</span>
                        {wordCount > 0 && (
                          <span>
                            📝 本课词{' '}
                            <span className="font-bold text-emerald-700">{masteredCount}</span>
                            <span className="text-gray-400"> / {wordCount} 已掌握</span>
                          </span>
                        )}
                        {glossaryCount > 0 && <span>📒 {glossaryCount} 难点词</span>}
                      </div>
                    </Link>
                  </div>
                  <div
                    className={clsx(
                      'relative flex shrink-0 flex-col items-center justify-between gap-1.5 self-stretch py-0.5 pl-3',
                      'before:absolute before:inset-y-1 before:left-0 before:w-px',
                      'before:bg-orange-200/70',
                    )}
                  >
                    {passageHasAudio && (
                      <QueueToggleButton
                        active={inQueue}
                        position={inQueue ? queuePos + 1 : null}
                        onClick={() => toggleQueueMember(p.key)}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      {user && (
                        <IconButton
                          type="button"
                          aria-label={p.key === currentLessonKey ? '当前课' : '设为当前课'}
                          aria-pressed={p.key === currentLessonKey}
                          aria-busy={savingCurrentLesson}
                          title={
                            savingCurrentLesson
                              ? '保存中…'
                              : p.key === currentLessonKey
                                ? '当前课'
                                : '设为当前课'
                          }
                          disabled={savingCurrentLesson}
                          onClick={() => {
                            void markCurrentLesson(p.key)
                          }}
                          variant={p.key === currentLessonKey ? 'solid' : 'soft'}
                          color="orange"
                          radius="full"
                          size="2"
                        >
                          <svg
                            aria-hidden="true"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={p.key === currentLessonKey ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z" />
                          </svg>
                        </IconButton>
                      )}
                    </div>
                    {passageHasAudio && track && (
                      <IconButton
                        type="button"
                        aria-label={isPlayingInQueue ? '正在播放' : '播放本课'}
                        title="播放本课"
                        onClick={() => player.play([track])}
                        variant={isPlayingInQueue ? 'solid' : 'soft'}
                        color="orange"
                        radius="full"
                        size="2"
                      >
                        ▶
                      </IconButton>
                    )}
                  </div>
                </li>
              )
            },
          )}
        </ul>
      )}

      {collection === 'houhai' && (playbackError || baiduError) && (
        <p role="alert" className="mb-24 text-sm text-red-700">
          {playbackError || baiduError}
        </p>
      )}
      <PlayerDock player={player} theme="light" />
    </main>
  )
}

function QueueToggleButton({
  active,
  position,
  onClick,
}: {
  active: boolean
  position: number | null
  onClick: () => void
}) {
  return (
    <IconButton
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-label={active ? `从选中移除 (#${position})` : '加入播放选择'}
      title={active ? `从选中移除 (#${position})` : '加入播放选择'}
      variant={active ? 'solid' : 'soft'}
      color="orange"
      radius="full"
      size="2"
      className="relative"
    >
      {active ? '✓' : '＋'}
      {active && position != null && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 font-mono text-[9px] font-bold text-white ring-2 ring-white"
        >
          {position}
        </span>
      )}
    </IconButton>
  )
}
