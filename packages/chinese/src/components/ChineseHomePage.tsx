'use client'

import Link from 'next/link'
import type { ChineseLessonMeta, ChineseUnitEntry } from '../utils/g1b/types'
import { getChineseBook, type ChineseBookSlug } from '../utils/chinese-books'
import { chineseRoute } from '../utils/chinese-routes'
import { useChineseContext } from '../context/ChineseContext'
import ChineseDailyCard from './ChineseDailyCard'
import ChineseMasteryStatsBar from './ChineseMasteryStatsBar'
import { ChinesePageHeader, ChinesePageShell } from './ChinesePageLayout'

function bookQuickLinks(bookSlug: ChineseBookSlug) {
  return [
    {
      href: chineseRoute(bookSlug, 'chars'),
      label: '生字',
      description: '认读 · 会写 · 字卡',
      className: 'from-rose-50 to-orange-50 border-rose-200 text-rose-900',
    },
    {
      href: chineseRoute(bookSlug, 'reading'),
      label: '阅读',
      description: '课文 · 高亮 · 回想',
      className: 'from-amber-50 to-orange-50 border-amber-200 text-amber-900',
    },
    {
      href: chineseRoute(bookSlug, 'poems'),
      label: '古诗',
      description: '听读 · 填空 · 背诵',
      className: 'from-violet-50 to-fuchsia-50 border-violet-200 text-violet-900',
    },
    {
      href: chineseRoute(bookSlug, 'daily'),
      label: '今日',
      description: '每日新字 · 测验',
      className: 'from-sky-50 to-indigo-50 border-sky-200 text-sky-900',
    },
    {
      href: chineseRoute(bookSlug, 'accumulation'),
      label: '积累',
      description: '园地 · 谚语名言',
      className: 'from-teal-50 to-cyan-50 border-teal-200 text-teal-900',
    },
  ] as const
}

type ChineseHomePageProps = {
  bookSlug?: ChineseBookSlug
}

export default function ChineseHomePage({ bookSlug: bookSlugProp }: ChineseHomePageProps) {
  const { unresolvedWrong, bookSlug: contextBookSlug } = useChineseContext()
  const bookSlug = bookSlugProp ?? contextBookSlug
  const book = getChineseBook(bookSlug)
  const units = book?.units ?? []
  const quickLinks = bookQuickLinks(bookSlug)

  return (
    <ChinesePageShell width="wide">
      <ChinesePageHeader
        eyebrow="语文学习"
        title={book?.label ?? bookSlug}
        description="部编版 · 生字、阅读、古诗与日积月累"
      />

      <div className="space-y-8">
        <ChineseDailyCard />

        <ChineseMasteryStatsBar />

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">
            快捷入口
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 sm:gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-gradient-to-br p-4 text-center no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${link.className}`}
              >
                <span className="text-sm font-extrabold">{link.label}</span>
                <span className="text-[10px] leading-snug opacity-75">{link.description}</span>
              </Link>
            ))}
            {unresolvedWrong.length > 0 && (
              <Link
                href="/chinese/wrong"
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-4 text-center text-rose-900 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
              >
                <span className="text-sm font-extrabold">错题本</span>
                <span className="text-[10px] leading-snug opacity-75">
                  {unresolvedWrong.length} 道待复习
                </span>
              </Link>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">
            {units.length} 个单元
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3 sm:gap-4">
            {units.map((unit: ChineseUnitEntry) => (
              <Link
                key={unit.unit}
                href={chineseRoute(bookSlug, 'units', String(unit.unit))}
                className="block min-h-32 rounded-2xl border border-slate-200 bg-white p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-extrabold text-slate-800">{unit.title}</h3>
                  <span className="shrink-0 text-xs font-semibold text-amber-600">
                    {unit.unitType === 'literacy' ? '识字' : '阅读'}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {unit.lessons.slice(0, 4).map((lesson: ChineseLessonMeta) => (
                    <li
                      key={`${unit.unit}-${lesson.lesson}-${lesson.title}`}
                      className="text-xs text-slate-500"
                    >
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
    </ChinesePageShell>
  )
}
