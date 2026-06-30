'use client'

import { NavigationLink, ArrowIcon } from '@rosie/ui'

type GradeCardProps = {
  grade: number
  label: string
  lessonCount: number
  summary: string
  totalProblems: number
  practicedProblems: number
}

const gradeThemes: Record<number, { emoji: string; gradient: string; badge: string; deco: string }> = {
  1: {
    emoji: '🌱',
    gradient: 'from-blue-100 to-sky-50',
    badge: 'bg-blue-500/12 text-blue-800',
    deco: 'bg-blue-500',
  },
  2: {
    emoji: '🚀',
    gradient: 'from-violet-100 to-fuchsia-50',
    badge: 'bg-violet-500/12 text-violet-900',
    deco: 'bg-violet-500',
  },
  3: {
    emoji: '⭐',
    gradient: 'from-amber-100 to-orange-50',
    badge: 'bg-amber-500/12 text-amber-900',
    deco: 'bg-amber-500',
  },
}

const defaultTheme = {
  emoji: '📚',
  gradient: 'from-slate-100 to-slate-50',
  badge: 'bg-slate-500/12 text-slate-800',
  deco: 'bg-slate-500',
}

export default function GradeCard({
  grade,
  label,
  lessonCount,
  summary,
  totalProblems,
  practicedProblems,
}: GradeCardProps) {
  const theme = gradeThemes[grade] ?? defaultTheme
  const progress = totalProblems > 0 ? Math.round((practicedProblems / totalProblems) * 100) : 0

  return (
    <NavigationLink
      href={`/math/ny/g${grade}`}
      className="group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-[18px] border border-white/80 bg-white p-5 text-left shadow-[0_4px_20px_rgba(15,23,42,.05)] transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_16px_44px_rgba(15,23,42,.1)] dark:border-white/6 dark:bg-slate-800"
    >
      <div className={`absolute -top-8 -right-6 h-28 w-28 rounded-full opacity-[0.07] ${theme.deco}`} />
      <div className={`absolute -bottom-6 left-4 h-20 w-20 rounded-full opacity-[0.05] ${theme.deco}`} />

      <div className="relative z-1 flex items-start justify-between gap-3">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${theme.gradient}`}
        >
          {theme.emoji}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${theme.badge}`}>
          {lessonCount} 讲
        </span>
      </div>

      <div className="relative z-1 mt-4 flex items-end justify-between gap-2">
        <div>
          <div className="text-[22px] font-extrabold leading-tight text-gray-900 dark:text-white">
            {label}
          </div>
          <p className="text-text-secondary mt-1.5 line-clamp-2 text-[13px] leading-relaxed">
            {summary}
          </p>
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                已练 <span className="text-[14px] font-extrabold">{practicedProblems}</span>
                <span className="text-text-muted font-semibold"> / {totalProblems} 题</span>
              </span>
              <span className="text-[11px] font-extrabold text-gray-500">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${theme.deco}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all group-hover:bg-violet-500 group-hover:text-white dark:bg-slate-700">
          <ArrowIcon />
        </div>
      </div>
    </NavigationLink>
  )
}
