'use client'

import { NavigationLink } from '@rosie/ui'

type GradeCardProps = {
  grade: number
  label: string
  lessonCount: number
  summary: string
  totalProblems: number
  practicedProblems: number
}

const gradeThemes: Record<
  number,
  {
    emoji: string
    gradient: string
    border: string
    shadow: string
    hoverShadow: string
    blobA: string
    blobB: string
    badge: string
    title: string
    summary: string
    progressTrack: string
    progressFill: string
    cta: string
    ctaHover: string
    accent: string
  }
> = {
  1: {
    emoji: '🌱',
    gradient: '#dbeafe',
    border: '2px solid rgba(59,130,246,.28)',
    shadow: 'shadow-sticker-sm',
    hoverShadow: 'hover:shadow-sticker',
    blobA: 'bg-blue-300/25',
    blobB: 'bg-sky-300/20',
    badge: 'bg-blue-100 text-blue-800',
    title: 'text-blue-950',
    summary: 'text-blue-900/70',
    progressTrack: 'bg-blue-100/80',
    progressFill: '#3b82f6',
    cta: 'bg-blue-50/90 text-blue-800',
    ctaHover: 'group-hover:bg-blue-500 group-hover:text-white',
    accent: '#3b82f6',
  },
  2: {
    emoji: '🚀',
    gradient: '#ede9fe',
    border: '2px solid rgba(139,92,246,.28)',
    shadow: 'shadow-sticker-sm',
    hoverShadow: 'hover:shadow-sticker',
    blobA: 'bg-violet-300/25',
    blobB: 'bg-fuchsia-300/20',
    badge: 'bg-violet-100 text-violet-900',
    title: 'text-violet-950',
    summary: 'text-violet-900/70',
    progressTrack: 'bg-violet-100/80',
    progressFill: '#8b5cf6',
    cta: 'bg-violet-50/90 text-violet-900',
    ctaHover: 'group-hover:bg-violet-500 group-hover:text-white',
    accent: '#8b5cf6',
  },
  3: {
    emoji: '⭐',
    gradient: '#fef3c7',
    border: '2px solid rgba(245,158,11,.28)',
    shadow: 'shadow-sticker-sm',
    hoverShadow: 'hover:shadow-sticker',
    blobA: 'bg-amber-300/25',
    blobB: 'bg-orange-300/20',
    badge: 'bg-amber-100 text-amber-900',
    title: 'text-amber-950',
    summary: 'text-amber-900/70',
    progressTrack: 'bg-amber-100/80',
    progressFill: '#f59e0b',
    cta: 'bg-amber-50/90 text-amber-900',
    ctaHover: 'group-hover:bg-amber-500 group-hover:text-white',
    accent: '#f59e0b',
  },
}

const defaultTheme = gradeThemes[1]!

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
    <NavigationLink href={`/math/ny/${grade}`} className="group block h-full w-full no-underline">
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[20px] text-left transition-all duration-300 group-hover:-translate-y-1 ${theme.shadow} ${theme.hoverShadow}`}
        style={{
          background: theme.gradient,
          border: theme.border,
        }}
      >
        <div className="h-1 shrink-0" style={{ background: theme.accent }} />

        <div
          className={`pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full ${theme.blobA}`}
        />
        <div
          className={`pointer-events-none absolute -bottom-6 left-6 h-20 w-20 rounded-full ${theme.blobB}`}
        />

        <div className="relative flex flex-1 flex-col px-5 py-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="shadow-sticker-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[26px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              {theme.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[20px] leading-tight font-extrabold ${theme.title}`}>
                  {label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${theme.badge}`}
                >
                  {lessonCount} 讲
                </span>
              </div>
              <p
                className={`mt-1 line-clamp-2 min-h-10 text-[12px] leading-relaxed font-medium ${theme.summary}`}
              >
                {summary}
              </p>
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className={`text-[12px] font-bold ${theme.title}`}>
                已练 <span className="text-[14px] font-extrabold">{practicedProblems}</span>
                <span className="font-semibold opacity-70"> / {totalProblems} 题</span>
              </span>
              <span className={`text-[11px] font-extrabold ${theme.summary}`}>{progress}%</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${theme.progressTrack}`}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: theme.progressFill }}
              />
            </div>
          </div>

          <div
            className={`mt-auto flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-all duration-200 ${theme.cta} ${theme.ctaHover}`}
          >
            进入{label}
            <span className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </div>
      </div>
    </NavigationLink>
  )
}
