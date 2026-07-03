'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { todayStr } from '@rosie/core'
import {
  CharWriter,
  buildDayQuizItems,
  buildTodayQuizItems,
  getLessonGroup,
  useChineseContext,
} from '@rosie/chinese'

type WriterMode = 'quiz' | 'animate'

export default function ChineseCharWritingPage() {
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const {
    weeklyPlan,
    lessonGroups,
    charByKey,
    getCharProfile,
    masteryMap,
    recordBatch,
    isCharDataReady,
    charKeyForBook,
    bookSlug,
  } = useChineseContext()
  const today = todayStr()
  const todayPlan = weeklyPlan?.days.find((d) => d.date === today)

  const items = useMemo(() => {
    if (!isCharDataReady) return []
    const all =
      lessonParam && getLessonGroup(lessonGroups, lessonParam, bookSlug)
        ? (() => {
            const group = getLessonGroup(lessonGroups, lessonParam, bookSlug)!
            const writeKeys = group.write.map((ch) => charKeyForBook(ch))
            return buildDayQuizItems(lessonGroups, charByKey, lessonParam, [], writeKeys, [], [], bookSlug)
          })()
        : todayPlan
          ? buildTodayQuizItems(lessonGroups, charByKey, masteryMap, todayPlan, today)
          : []
    return all.filter((i) => i.track === 'write')
  }, [
    lessonParam,
    todayPlan,
    lessonGroups,
    charByKey,
    masteryMap,
    isCharDataReady,
    today,
    charKeyForBook,
    bookSlug,
  ])

  const [idx, setIdx] = useState(0)
  const [mode, setMode] = useState<WriterMode>('quiz')
  const [modeKey, setModeKey] = useState(0)
  const [lastMistakes, setLastMistakes] = useState<number | null>(null)

  const current = items[idx]
  const profile = current ? getCharProfile(current.charKey) : undefined

  const handleQuizComplete = useCallback(
    (summary: { totalMistakes: number }) => {
      if (!current) return
      setLastMistakes(summary.totalMistakes)
      recordBatch([
        {
          charKey: current.charKey,
          track: 'write',
          correct: summary.totalMistakes <= 2,
        },
      ])
    },
    [current, recordBatch],
  )

  const switchMode = (next: WriterMode) => {
    setMode(next)
    setModeKey((k) => k + 1)
    setLastMistakes(null)
  }

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，请先在 Supabase 灌入一年级下册字表。
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-slate-600">
        <p>今天没有会写字练习。</p>
        <Link href="/chinese/chars" className="mt-4 inline-block text-amber-700 no-underline">
          去生字库选课文 →
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <p className="p-6 text-center text-sm text-rose-600">无法加载当前生字。</p>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="text-center">
        <h1 className="text-lg font-extrabold text-slate-900">笔顺书写</h1>
        <p className="mt-1 text-xs text-slate-500">
          {idx + 1} / {items.length} · {current.lessonTitle}
          {current.isReview && <span className="ml-1 text-violet-600">复习</span>}
        </p>
        <p className="mt-1 text-sm font-semibold text-rose-800">
          {current.char}
          <span className="ml-2 text-slate-500 font-normal">{current.pinyin}</span>
        </p>
        {profile?.radicalName && (
          <p className="mt-0.5 text-xs text-indigo-700">部首：{profile.radicalName}</p>
        )}
        {profile?.structure && (
          <p className="mt-0.5 text-xs text-slate-500">结构：{profile.structure}</p>
        )}
      </header>

      <div className="mt-4" key={`${current.charKey}-${modeKey}`}>
        <CharWriter
          char={current.char}
          mode={mode}
          onQuizComplete={mode === 'quiz' ? handleQuizComplete : undefined}
        />
      </div>

      {lastMistakes !== null && mode === 'quiz' && (
        <p className="mt-3 text-center text-sm text-emerald-700">
          完成！错 {lastMistakes} 笔
          {lastMistakes <= 2 ? ' · 很棒 🎉' : ' · 再练一次会更好'}
        </p>
      )}

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => switchMode('animate')}
          className={`rounded-lg px-3 py-2 text-xs font-bold ${
            mode === 'animate'
              ? 'bg-amber-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          看笔顺
        </button>
        <button
          type="button"
          onClick={() => switchMode('quiz')}
          className={`rounded-lg px-3 py-2 text-xs font-bold ${
            mode === 'quiz'
              ? 'bg-sky-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          书写练习
        </button>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => {
            setIdx((i) => i - 1)
            setLastMistakes(null)
            setModeKey((k) => k + 1)
          }}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          上一字
        </button>
        <button
          type="button"
          disabled={idx >= items.length - 1}
          onClick={() => {
            setIdx((i) => i + 1)
            setLastMistakes(null)
            setModeKey((k) => k + 1)
          }}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          下一字
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-400">
        在格子里按笔顺描红；连错 3 次会高亮提示下一笔。
      </p>
    </div>
  )
}
