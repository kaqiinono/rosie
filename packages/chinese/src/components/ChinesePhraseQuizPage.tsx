'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { todayStr } from '@rosie/core'
import {
  PhraseQuizRunner,
  buildLessonPhraseItems,
  getLessonGroup,
  getLessonPhraseCharPool,
  pickDailyPhraseItems,
  useChineseContext,
} from '@rosie/chinese'

export default function ChinesePhraseQuizPage() {
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const { weeklyPlan, lessons, lessonGroups, charByKey, isCharDataReady, addWrong, markWrongResolved } =
    useChineseContext()
  const today = todayStr()
  const todayPlan = weeklyPlan?.days.find((d) => d.date === today)

  const activeLessonKey =
    lessonParam ?? todayPlan?.lessonKey ?? lessonGroups[0]?.lessonKey ?? 'u1-l1'
  const [lessonKey, setLessonKey] = useState('')
  const resolvedKey = lessonKey || activeLessonKey

  const group = useMemo(() => getLessonGroup(lessonGroups, resolvedKey), [lessonGroups, resolvedKey])
  const lesson = useMemo(
    () => lessons.find((l) => l.lessonKey === resolvedKey),
    [lessons, resolvedKey],
  )

  const allItems = useMemo(
    () => (group && lesson ? buildLessonPhraseItems(lesson, group, charByKey) : []),
    [group, lesson, charByKey],
  )

  const dailyMode = !lessonParam && !!todayPlan
  const items = useMemo(
    () => (dailyMode ? pickDailyPhraseItems(allItems, 6) : allItems),
    [allItems, dailyMode],
  )

  const charPool = useMemo(() => (group ? getLessonPhraseCharPool(group) : []), [group])

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，请先在 Supabase 灌入一年级下册字表。
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="text-center">
        <h1 className="text-xl font-extrabold text-slate-900">词语测验</h1>
        <p className="mt-1 text-sm text-slate-500">组词 · 读一读记一记</p>
      </header>

      <label className="mt-4 block text-xs font-bold text-slate-500">
        选择课文
        <select
          value={resolvedKey}
          onChange={(e) => setLessonKey(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          {lessonGroups.map((g) => (
            <option key={g.lessonKey} value={g.lessonKey}>
              {g.lessonTitle}
            </option>
          ))}
        </select>
      </label>

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">本课暂无词语练习题。</p>
      ) : (
        <div className="mt-6">
          {dailyMode && (
            <p className="mb-4 text-center text-xs text-violet-700">
              今日练习 {items.length} 题（共 {allItems.length} 题可练）
            </p>
          )}
          <PhraseQuizRunner
            items={items}
            charPool={charPool}
            onComplete={(results) => {
              for (const r of results) {
                if (r.correct) void markWrongResolved(r.id, 'phrase')
                else void addWrong(r.id, 'phrase', 'phrase')
              }
            }}
          />
        </div>
      )}

      {!dailyMode && allItems.length > items.length && (
        <p className="mt-4 text-center text-xs text-slate-400">
          显示全部 {allItems.length} 题
        </p>
      )}

      <Link
        href="/chinese/chars"
        className="mt-8 block text-center text-xs font-semibold text-amber-700 no-underline"
      >
        ← 返回生字库
      </Link>
    </div>
  )
}
