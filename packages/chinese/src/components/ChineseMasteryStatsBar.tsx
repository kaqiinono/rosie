'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useChineseContext } from '../context/ChineseContext'
import { computeChineseMasteryStats } from '../utils/chinese-mastery-stats'

type StatCard = {
  href: string
  label: string
  value: string
  hint: string
  className: string
}

export default function ChineseMasteryStatsBar() {
  const { masteryMap, lessonGroups, isCharDataLoading } = useChineseContext()

  const stats = useMemo(
    () => computeChineseMasteryStats(masteryMap, lessonGroups),
    [masteryMap, lessonGroups],
  )

  const cards: StatCard[] = [
    {
      href: '/chinese/chars',
      label: '会认',
      value: `${stats.recognizePracticed}/${stats.recognizeTotal}`,
      hint:
        stats.recognizeGraduated > 0
          ? `已练 · 毕业 ${stats.recognizeGraduated}`
          : '已练 / 会认总数',
      className: 'from-sky-50 to-indigo-50 border-sky-100 text-sky-800',
    },
    {
      href: '/chinese/chars/writing',
      label: '会写',
      value: `${stats.writePracticed}/${stats.writeTotal}`,
      hint:
        stats.writeGraduated > 0
          ? `已练 · 毕业 ${stats.writeGraduated}`
          : '已练 / 会写总数',
      className: 'from-amber-50 to-orange-50 border-amber-100 text-amber-800',
    },
  ]

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">学习进度</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`rounded-2xl border bg-gradient-to-br p-4 no-underline transition hover:-translate-y-0.5 hover:shadow-md ${card.className}`}
          >
            <div className="text-[11px] font-extrabold tracking-wide opacity-80">{card.label}</div>
            <div className="font-fredoka mt-1 text-[clamp(24px,5vw,32px)] leading-none font-black tabular-nums">
              {isCharDataLoading ? '—' : card.value}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold leading-snug opacity-70">
              {isCharDataLoading ? '加载中' : card.hint}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
