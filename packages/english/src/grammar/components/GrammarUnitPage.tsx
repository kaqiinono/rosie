'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { OrbBackground, BackLink } from '@rosie/ui'
import { useAuth } from '@rosie/core'
import { useGrammarUnit } from '../hooks/useGrammarUnit'
import { useGrammarMastery } from '../hooks/useGrammarMastery'
import { LessonView } from './LessonView'
import { ExerciseView } from './ExerciseView'

type Tab = 'lesson' | 'exercise'

function BookPagesChip({ pages }: { pages: number[] }) {
  if (pages.length === 0) return null
  const label = pages.length >= 2 && pages[1] - pages[0] === pages.length - 1
    ? `p.${pages[0]}–${pages[pages.length - 1]}`
    : pages.map((p) => `p.${p}`).join(' · ')
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted ring-1 ring-border-light">
      📖 原书 {label}
    </span>
  )
}

export default function GrammarUnitPage({ unitNumber }: { unitNumber: number }) {
  const { user } = useAuth()
  const { unit, isLoading, notFound } = useGrammarUnit(unitNumber)
  const { masteryMap, recordPractice } = useGrammarMastery(user)
  const [tab, setTab] = useState<Tab>('lesson')

  // 聚合各练习组结果：全部组上报后求和写 mastery；summary 带 unitNumber 标记，切单元时自动失效
  const groupResults = useRef<{ unit: number; results: Map<number, { correct: number; total: number }> }>({
    unit: unitNumber,
    results: new Map(),
  })
  const [summary, setSummary] = useState<{ unit: number; text: string } | null>(null)
  const reportedSummary = summary !== null && summary.unit === unitNumber ? summary.text : null

  const handleGroupResult = useCallback(
    (groupIdx: number, correct: number, total: number) => {
      if (!unit) return
      // 切单元后首次上报时重置旧结果，不在 render 阶段碰 ref
      if (groupResults.current.unit !== unitNumber) {
        groupResults.current = { unit: unitNumber, results: new Map() }
      }
      groupResults.current.results.set(groupIdx, { correct, total })
      if (groupResults.current.results.size < unit.exercises.length) return
      let sumCorrect = 0
      let sumTotal = 0
      for (const r of groupResults.current.results.values()) {
        sumCorrect += r.correct
        sumTotal += r.total
      }
      setSummary({ unit: unitNumber, text: `${sumCorrect}/${sumTotal}` })
      void recordPractice(unitNumber, sumCorrect, sumTotal)
    },
    [unit, recordPractice, unitNumber],
  )

  if (isLoading) {
    return (
      <>
        <OrbBackground variant="home" />
        <BackLink />
        <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[760px] flex-col gap-4 px-4 pt-24 sm:px-6">
          <div className="h-24 animate-pulse rounded-2xl bg-surface/70 ring-1 ring-border-light" />
          <div className="h-64 animate-pulse rounded-2xl bg-surface/70 ring-1 ring-border-light" />
        </div>
      </>
    )
  }

  if (notFound || !unit) {
    return (
      <>
        <OrbBackground variant="home" />
        <BackLink />
        <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[760px] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-black text-text-primary">该单元尚未解锁</h1>
          <p className="text-sm text-text-secondary">内容还在提取中，先去看看其他单元吧</p>
          <Link
            href="/english/grammar"
            className="rounded-full bg-gradient-to-r from-app-blue to-sky-500 px-6 py-2 text-sm font-bold text-white shadow-md shadow-sky-200 transition-transform active:scale-95"
          >
            返回语法地图
          </Link>
        </div>
      </>
    )
  }

  const currentRecord = masteryMap[unitNumber]

  return (
    <>
      <OrbBackground variant="home" />
      <BackLink />

      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[760px] flex-col gap-5 px-4 pt-20 pb-16 sm:px-6">
        <header className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-app-blue-light px-3 py-1 text-xs font-bold text-app-blue-dark">
              {unit.categoryZh || unit.category}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted ring-1 ring-border-light">
              难度 {'⭐'.repeat(unit.difficulty)}
            </span>
            <BookPagesChip pages={unit.bookPages} />
            {currentRecord?.mastered && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-app-green-light px-3 py-1 text-xs font-bold text-app-green-dark">
                ⭐ 已掌握
              </span>
            )}
          </div>
          <h1 className="mt-2 text-[clamp(24px,4.5vw,32px)] font-black text-text-primary">
            Unit {unit.unitNumber} · {unit.title}
          </h1>
          {unit.titleZh && <p className="mt-1 text-sm text-text-secondary">{unit.titleZh}</p>}
        </header>

        <div className="mx-auto flex rounded-full bg-surface p-1 shadow-sm ring-1 ring-border-light">
          {(
            [
              { id: 'lesson', label: '📖 讲解' },
              { id: 'exercise', label: '✏️ 练习' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-6 py-1.5 text-sm font-bold transition-all ${
                tab === t.id
                  ? 'bg-gradient-to-r from-app-blue to-sky-500 text-white shadow-md shadow-sky-200'
                  : 'text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <main key={tab} className="animate-fade-up rounded-2xl bg-surface/90 p-4 shadow-sm ring-1 ring-border-light backdrop-blur-sm sm:p-6">
          {tab === 'lesson' ? (
            <LessonView data={unit.lesson} />
          ) : (
            <>
              <ExerciseView groups={unit.exercises} onGroupResult={handleGroupResult} />
              {reportedSummary && (
                <div
                  className={`mt-4 rounded-xl p-3 text-center text-sm font-bold ${
                    reportedSummary.split('/')[0] === reportedSummary.split('/')[1]
                      ? 'bg-app-green-light text-app-green-dark'
                      : 'bg-surface-dim text-text-secondary'
                  }`}
                >
                  本单元练习 {reportedSummary}
                  {reportedSummary.split('/')[0] === reportedSummary.split('/')[1] ? ' · 全部答对，已标记掌握 🎉' : ' · 加油，再试一次就能全部答对！'}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
