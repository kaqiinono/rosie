'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useAuth, supabase } from '@rosie/core'
import { useWeeklyPlan } from '@rosie/english'
import { useReadingPassageMedia } from '@rosie/english'
import { usePlaylistPlayer } from '@rosie/player'
import { useWordsContext } from '@rosie/english'
import { ReadingAudioUploadButton } from '@rosie/english'
import { PlayerDock } from '@rosie/player'
import { parseFocusLessonKey, readingPassages } from '@rosie/english'
import { READING_AUDIO_BUCKET, readingPassageAudioPath } from '@rosie/english'
import { wordKey } from '@rosie/english'
import { getWordMasteryLevel } from '@rosie/core'
import { type PlayerTrack } from '@rosie/player'

export default function ReadingIndexPage() {
  const { user } = useAuth()
  const { weeklyPlan, isLoading } = useWeeklyPlan(user)
  const { vocab, masteryMap } = useWordsContext()
  const { hasAudio, uploadPassageAudio } = useReadingPassageMedia(user)
  const player = usePlaylistPlayer()

  // 选中集（用于"播放选中"）
  const [queueKeys, setQueueKeys] = useState<string[]>([])

  const focusKey = weeklyPlan?.focusLessonKey ?? null
  const parsedFocus = useMemo(
    () => (focusKey ? parseFocusLessonKey(focusKey) : null),
    [focusKey],
  )

  const cards = useMemo(() => {
    const num = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? '0', 10)
    const sorted = [...readingPassages].sort((a, b) => {
      if (a.stage !== b.stage) return b.stage.localeCompare(a.stage)
      if (a.unit !== b.unit) return num(b.unit) - num(a.unit)
      return num(b.lesson) - num(a.lesson)
    })
    return sorted.map((p) => {
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
  }, [vocab, masteryMap, parsedFocus])

  // 直接从 reading 自己的课文构建播放曲目（reading_passage_media / 'reading' bucket），
  // 按 passage key 建索引。不依赖 audio 模块的收藏夹聚合，连播留在 reading 自己范围内。
  const trackByKey = useMemo(() => {
    const map = new Map<string, PlayerTrack>()
    for (const p of readingPassages) {
      if (!hasAudio(p.key)) continue
      const { data } = supabase.storage
        .from(READING_AUDIO_BUCKET)
        .getPublicUrl(readingPassageAudioPath(p.key))
      if (!data?.publicUrl) continue
      map.set(p.key, {
        url: data.publicUrl,
        label: p.title,
        refLink: `/english/words/reading/${p.key}`,
        mediaType: 'audio',
        source: null,
      })
    }
    return map
  }, [hasAudio])

  const audiobookKeys = useMemo(
    () => readingPassages.filter((p) => hasAudio(p.key)).map((p) => p.key),
    [hasAudio],
  )

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

  return (
    <main
      className="font-nunito relative z-[1] mx-auto max-w-3xl px-4 pt-6 pb-32"
      style={{ colorScheme: 'light' }}
    >
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="font-fredoka shrink-0 text-xl font-bold text-[var(--wm-text)] sm:text-2xl">
          📚 阅读课文
        </h1>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            disabled={audiobookKeys.length === 0}
            onClick={() => playKeys(hasSelection ? selectedKeys : audiobookKeys)}
            className="font-fredoka rounded-full bg-gradient-to-br from-orange-400 to-amber-500 px-4 py-2 text-[13px] font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50"
          >
            ▶{' '}
            {audiobookKeys.length === 0
              ? '暂无音频'
              : hasSelection
                ? `播放选中 ${selectedKeys.length}`
                : `播放全部 ${audiobookKeys.length}`}
          </button>
          {player.queue.length > 0 && (
            <button
              type="button"
              onClick={player.stop}
              className="rounded-full bg-white px-3 py-2 text-[13px] font-bold text-orange-700 ring-1 ring-orange-200 transition active:scale-95"
            >
              停止
            </button>
          )}
        </div>
      </div>
      {isLoading && (
        <div className="mb-3 text-[11px] text-[var(--wm-text-dim)]">载入多日计划…</div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200">
          <div className="mb-2 text-4xl">📭</div>
          <div className="font-bold text-gray-800">还没有课文</div>
          <div className="mt-1 text-[12px] text-gray-500">敬请期待新课文上线。</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map(({ passage: p, wordCount, masteredCount, glossaryCount, paragraphCount, isFocus }) => {
            const passageHasAudio = hasAudio(p.key)
            const track = trackByKey.get(p.key)
            const queuePos = queueKeys.indexOf(p.key)
            const inQueue = queuePos !== -1
            const isPlayingInQueue =
              !!current?.refLink && current.refLink === `/english/words/reading/${p.key}`
            return (
              <li
                key={p.key}
                className={clsx(
                  'rounded-2xl bg-white p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,158,11,.18)] sm:p-5',
                  isPlayingInQueue
                    ? 'ring-2 ring-orange-400 shadow-[0_6px_20px_rgba(245,158,11,.25)]'
                    : 'ring-gray-200 hover:ring-orange-300',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/english/words/reading/${p.key}`}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 no-underline ring-1 ring-orange-200 transition hover:bg-orange-100"
                  >
                    📖 {p.unit} · {p.lesson}
                  </Link>
                  {isFocus && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-sky-300">
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
                <div className="flex items-stretch justify-between gap-3">
                  <Link
                    href={`/english/words/reading/${p.key}`}
                    className="group min-w-0 flex-1 no-underline"
                  >
                    <h2 className="font-fredoka text-lg font-bold text-gray-900 group-hover:text-orange-700 sm:text-xl">
                      {p.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-600">
                      <span>📄 {paragraphCount} 段</span>
                      {wordCount > 0 && (
                        <span>
                          📝 本课词 <span className="font-bold text-emerald-700">{masteredCount}</span>
                          <span className="text-gray-400"> / {wordCount} 已掌握</span>
                        </span>
                      )}
                      {glossaryCount > 0 && <span>📒 {glossaryCount} 难点词</span>}
                    </div>
                  </Link>
                  <div
                    className={clsx(
                      'relative flex shrink-0 flex-col items-end justify-between gap-1.5 self-stretch py-0.5 pl-3',
                      'before:absolute before:inset-y-1 before:left-0 before:w-px',
                      'before:bg-gradient-to-b before:from-transparent before:via-orange-200/70 before:to-transparent',
                      'sm:flex-row sm:items-center sm:justify-end sm:self-auto sm:py-0 sm:pl-0',
                      'sm:before:hidden',
                    )}
                  >
                    {passageHasAudio && (
                      <QueueToggleButton
                        active={inQueue}
                        position={inQueue ? queuePos + 1 : null}
                        onClick={() => toggleQueueMember(p.key)}
                      />
                    )}
                    <ReadingAudioUploadButton
                      passageKey={p.key}
                      hasAudio={hasAudio(p.key)}
                      onUpload={uploadPassageAudio}
                      size="sm"
                    />
                    {passageHasAudio && track && (
                      <button
                        type="button"
                        aria-label={isPlayingInQueue ? '正在播放' : '播放本课'}
                        title="播放本课"
                        onClick={() => player.play([track])}
                        className={clsx(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] ring-1 transition active:scale-95',
                          isPlayingInQueue
                            ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white ring-orange-300'
                            : 'bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
                        )}
                      >
                        ▶
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
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
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-label={active ? `从选中移除 (#${position})` : '加入播放选择'}
      title={active ? `从选中移除 (#${position})` : '加入播放选择'}
      className={clsx(
        'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] ring-1 transition active:scale-95',
        active
          ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white ring-orange-300 shadow-sm'
          : 'bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
      )}
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
    </button>
  )
}
