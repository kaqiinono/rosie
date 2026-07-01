'use client'

import Link from 'next/link'
import { UNITS } from '../utils/grade1-down'
import type { ChineseLessonMeta, ChineseUnitEntry } from '../utils/grade1-down/types'
import { useChineseContext } from '../context/ChineseContext'
import ChineseMasteryStatsBar from './ChineseMasteryStatsBar'

const QUICK_LINKS = [
  {
    href: '/chinese/chars',
    icon: '字',
    label: '生字',
    description: '认读 · 会写 · 字卡',
    className: 'from-rose-50 to-orange-50 border-rose-200 text-rose-900',
  },
  {
    href: '/chinese/poems',
    icon: '诗',
    label: '古诗',
    description: '听读 · 填空 · 背诵',
    className: 'from-violet-50 to-fuchsia-50 border-violet-200 text-violet-900',
  },
  {
    href: '/chinese/daily',
    icon: '今',
    label: '今日',
    description: '每日新字 · 测验',
    className: 'from-sky-50 to-indigo-50 border-sky-200 text-sky-900',
  },
  {
    href: '/chinese/accumulation',
    icon: '积',
    label: '积累',
    description: '园地 · 谚语名言',
    className: 'from-teal-50 to-cyan-50 border-teal-200 text-teal-900',
  },
] as const

export default function ChineseHomePage() {
  const { unresolvedWrong } = useChineseContext()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">语文 · 一年级下册</h1>
        <p className="mt-1 text-sm text-slate-500">部编版 · 生字与古诗</p>
      </header>

      <ChineseMasteryStatsBar />

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">快捷入口</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 bg-gradient-to-br p-4 text-center no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${link.className}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-lg font-extrabold shadow-inner">
                {link.icon}
              </span>
              <span className="text-sm font-extrabold">{link.label}</span>
              <span className="text-[10px] leading-snug opacity-75">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {unresolvedWrong.length > 0 && (
        <Link
          href="/chinese/wrong"
          className="block rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-800 no-underline"
        >
          错题本（{unresolvedWrong.length}）
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">八个单元</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {UNITS.map((unit: ChineseUnitEntry) => (
            <Link
              key={unit.unit}
              href={`/chinese/units/${unit.unit}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 no-underline shadow-sm transition hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-slate-800">{unit.title}</h3>
                <span className="shrink-0 text-xs font-semibold text-amber-600">
                  {unit.unitType === 'literacy' ? '识字' : '阅读'}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5">
                {unit.lessons.slice(0, 4).map((lesson: ChineseLessonMeta) => (
                  <li key={`${unit.unit}-${lesson.lesson}-${lesson.title}`} className="text-xs text-slate-500">
                    {lesson.title}
                  </li>
                ))}
                {unit.lessons.length > 4 && (
                  <li className="text-xs text-slate-400">…共 {unit.lessons.length} 课</li>
                )}
              </ul>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
