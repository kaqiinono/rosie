'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getBookPoems, getBookAccumulation } from '../utils/chinese-book-content'
import { ACCUMULATION_KIND_LABEL, buildAccumulationQuizItems } from '../utils/chinese-accumulation-helpers'
import AccumulationQuizRunner from './accumulation/AccumulationQuizRunner'
import PoemList from './poems/PoemList'
import { getGardenLessonGroups } from '../utils/chinese-garden-helpers'
import { useChineseContext } from '../context/ChineseContext'

export default function ChineseAccumulationPage() {
  const searchParams = useSearchParams()
  const unitParam = searchParams.get('unit')
  const unitFilter = unitParam ? Number(unitParam) : undefined
  const { addWrong, markWrongResolved, lessonGroups, bookSlug } = useChineseContext()
  const accumulation = useMemo(() => getBookAccumulation(bookSlug), [bookSlug])
  const gardenPoems = useMemo(
    () => getBookPoems(bookSlug).filter((p) => p.source === 'garden'),
    [bookSlug],
  )
  const gardenGroups = useMemo(() => getGardenLessonGroups(lessonGroups), [lessonGroups])

  const [activeUnit, setActiveUnit] = useState<number | 'all'>(unitFilter ?? 'all')
  const [quizzing, setQuizzing] = useState(unitFilter !== undefined)

  const items = useMemo(
    () =>
      buildAccumulationQuizItems(
        accumulation,
        activeUnit === 'all' ? undefined : activeUnit,
      ),
    [activeUnit, accumulation],
  )

  const handleComplete = (results: { id: string; correct: boolean }[]) => {
    for (const r of results) {
      if (r.correct) void markWrongResolved(r.id, 'accumulation')
      else void addWrong(r.id, 'accumulation', 'accumulation')
    }
    setQuizzing(false)
  }

  if (quizzing && items.length > 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          type="button"
          onClick={() => setQuizzing(false)}
          className="mb-4 text-xs font-semibold text-teal-700"
        >
          ← 返回列表
        </button>
        <AccumulationQuizRunner items={items} onComplete={handleComplete} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">日积月累</h1>
        <p className="mt-1 text-sm text-slate-500">园地积累 · 词语 · 谚语 · 名言</p>
      </header>

      <section className="mt-6 space-y-3">
        {accumulation.map((block) => (
          <div
            key={`${block.unit}-${block.kind}`}
            className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50 to-cyan-50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-teal-700">
                  第 {block.unit} 单元 · {ACCUMULATION_KIND_LABEL[block.kind]}
                </p>
                <ul className="mt-2 space-y-1">
                  {block.items.slice(0, 3).map((item) => (
                    <li key={item.text} className="text-sm text-slate-700">
                      {item.text}
                      {item.answer ? ` — ${item.answer}` : ''}
                    </li>
                  ))}
                  {block.items.length > 3 && (
                    <li className="text-xs text-slate-400">…共 {block.items.length} 条</li>
                  )}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveUnit(block.unit)
                  setQuizzing(true)
                }}
                className="shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white"
              >
                练习
              </button>
            </div>
          </div>
        ))}
      </section>

      {gardenGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-emerald-600 uppercase">
            识字加油站
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {gardenGroups.map((g) => (
              <Link
                key={g.lessonKey}
                href={`/chinese/garden?lesson=${g.lessonKey}`}
                className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 no-underline transition hover:border-emerald-400"
              >
                <span>第{g.unit}单元 · {g.lessonTitle}</span>
                <span className="text-xs text-emerald-600">{g.recognize.length} 字 →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-violet-600 uppercase">
          园地古诗
        </h2>
        <PoemList poems={gardenPoems} />
      </section>

      <button
        type="button"
        onClick={() => {
          setActiveUnit('all')
          setQuizzing(true)
        }}
        className="mt-6 w-full rounded-xl border-2 border-teal-400 py-3 text-sm font-bold text-teal-800"
      >
        全部练习（{buildAccumulationQuizItems(accumulation).length} 题）
      </button>

      <Link
        href="/chinese"
        className="mt-6 block text-center text-xs font-semibold text-slate-500 no-underline"
      >
        ← 返回语文首页
      </Link>
    </div>
  )
}
