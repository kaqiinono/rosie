'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { getWordMasteryLevel } from '@rosie/core'
import { useChineseContext } from '../../context/ChineseContext'
import { localLessonKey } from '../../utils/chinese-helpers'
import { getLessonPassage } from '../../utils/chinese-lesson-passage-helpers'
import {
  getLessonDisplayInfo,
  sortLessonsPedagogically,
} from '../../utils/chinese-lesson-display'
import { chineseRoute } from '../../utils/chinese-routes'

export default function ChineseReadingIndexPage() {
  const { lessons, lessonGroups, getMastery, isCharDataLoading, isCharDataReady, bookSlug, charKeyForBook } =
    useChineseContext()

  const cards = useMemo(() => {
    const withPassage = lessons.filter((l) => {
      const passage = getLessonPassage(l.lessonKey, bookSlug)
      return passage !== undefined && passage.paragraphs.length > 0
    })
    const ordered = sortLessonsPedagogically(withPassage)
    return ordered.map((lesson) => {
      const unitLessons = lessons.filter((l) => l.unit === lesson.unit)
      const display = getLessonDisplayInfo(lesson, unitLessons)
      const group = lessonGroups.find((g) => g.lessonKey === lesson.lessonKey)
      const recognize = group?.recognize ?? []
      const write = group?.write ?? []
      const total = recognize.length + write.length
      let mastered = 0
      for (const ch of recognize) {
        if (getWordMasteryLevel(getMastery(charKeyForBook(ch), 'recognize').correct) >= 3) mastered += 1
      }
      for (const ch of write) {
        if (getWordMasteryLevel(getMastery(charKeyForBook(ch), 'write').correct) >= 3) mastered += 1
      }
      return {
        lessonKey: lesson.lessonKey,
        unit: lesson.unit,
        title: lesson.lessonTitle,
        label: display.label,
        recognizeCount: recognize.length,
        writeCount: write.length,
        total,
        mastered,
      }
    })
  }, [lessons, lessonGroups, bookSlug, getMastery, charKeyForBook])

  if (isCharDataLoading && !isCharDataReady) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-extrabold text-slate-900">📖 课文阅读</h1>
        <p className="mt-0.5 text-sm text-amber-900/50">
          读课文 · 会认字会写字高亮 · 读完做回想测试
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">📭</div>
          <div className="font-bold text-slate-800">还没有课文</div>
          <div className="mt-1 text-[12px] text-slate-500">课文正文录入后会在这里出现。</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => {
            const pct = c.total > 0 ? Math.round((c.mastered / c.total) * 100) : 0
            return (
              <li key={c.lessonKey}>
                <Link
                  href={chineseRoute(bookSlug, 'reading', localLessonKey(c.lessonKey))}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                      第{c.unit}单元
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900">{c.label}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span className="flex items-center gap-1 font-bold text-sky-700">
                      <span className="inline-block h-2.5 w-2.5 rounded border border-sky-300 bg-sky-100" />
                      会认 {c.recognizeCount}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-rose-700">
                      <span className="inline-block h-2.5 w-2.5 rounded border border-rose-400 bg-rose-100" />
                      会写 {c.writeCount}
                    </span>
                    {c.total > 0 && (
                      <span className="ml-auto text-slate-400">
                        已掌握 <span className="font-bold text-emerald-600">{c.mastered}</span>/
                        {c.total}
                      </span>
                    )}
                  </div>
                  {c.total > 0 && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
