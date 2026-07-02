'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CharFlashCard,
  buildDayQuizItems,
  buildTodayQuizItems,
  getLessonGroup,
  findLessonRow,
  getLessonDisplayInfo,
  useChineseContext,
} from '@rosie/chinese'
import { todayStr } from '@rosie/core'

export default function ChineseCharCardsPage() {
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const { weeklyPlan, lessonGroups, lessons, charByKey, getCharProfile, masteryMap, isCharDataReady, charKeyForBook, bookSlug } =
    useChineseContext()
  const today = todayStr()
  const todayPlan = weeklyPlan?.days.find((d) => d.date === today)

  const items = useMemo(() => {
    if (!isCharDataReady) return []
    if (lessonParam) {
      const group = getLessonGroup(lessonGroups, lessonParam, bookSlug)
      if (!group) return []
      const recognizeKeys = group.recognize.map((ch) => charKeyForBook(ch))
      const writeKeys = group.write.map((ch) => charKeyForBook(ch))
      return buildDayQuizItems(
        lessonGroups,
        charByKey,
        lessonParam,
        recognizeKeys,
        writeKeys,
        [],
        [],
        bookSlug,
      )
    }
    if (todayPlan) {
      return buildTodayQuizItems(lessonGroups, charByKey, masteryMap, todayPlan, today)
    }
    return []
  }, [lessonParam, todayPlan, lessonGroups, charByKey, masteryMap, isCharDataReady, today, charKeyForBook, bookSlug])

  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const current = items[idx]
  const profile = current ? getCharProfile(current.charKey) : undefined
  const group = lessonParam ? getLessonGroup(lessonGroups, lessonParam, bookSlug) : undefined
  const lessonRow = lessonParam ? findLessonRow(lessons, lessonParam, bookSlug) : undefined
  const unitLessons = lessonRow ? lessons.filter((l) => l.unit === lessonRow.unit) : []
  const display = lessonRow ? getLessonDisplayInfo(lessonRow, unitLessons) : null

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，请先在 Supabase 灌入一年级下册字表。
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        请从生字库选择课文，或先生成本周计划。
      </p>
    )
  }

  if (!current) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <p className="text-center text-xs font-semibold text-slate-400">
        {idx + 1} / {items.length} · {current.lessonTitle}
        {current.isReview && <span className="ml-1 text-violet-500">复习</span>}
      </p>
      <div className="mt-4">
        <CharFlashCard
          data={{
            char: current.char,
            pinyin: current.pinyin,
            unit: group?.unit ?? 0,
            unitLessonNo: display?.unitLessonNo,
            bookLessonNo: display?.bookLessonNo,
            lessonTitle: current.lessonTitle,
            radical: profile?.radical,
            radicalName: profile?.radicalName,
            structure: profile?.structure,
            phrases: profile?.phrases,
            strokeCount: profile?.strokeCount,
            isReview: current.isReview,
          }}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
        />
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => {
            setIdx((i) => i - 1)
            setFlipped(false)
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
            setFlipped(false)
          }}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          下一字
        </button>
      </div>
    </div>
  )
}
