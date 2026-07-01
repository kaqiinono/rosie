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
    gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 55%, #e0f2fe 100%)',
    border: '2px solid rgba(59,130,246,.28)',
    shadow: 'shadow-[0_4px_20px_rgba(59,130,246,.1)]',
    hoverShadow: 'hover:shadow-[0_16px_44px_rgba(59,130,246,.22)]',
    blobA: 'bg-blue-300/25',
    blobB: 'bg-sky-300/20',
    badge: 'bg-blue-100 text-blue-800',
    title: 'text-blue-950',
    summary: 'text-blue-900/70',
    progressTrack: 'bg-blue-100/80',
    progressFill: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
    cta: 'bg-blue-50/90 text-blue-800',
    ctaHover: 'group-hover:bg-blue-500 group-hover:text-white',
    accent: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
  },
  2: {
    emoji: '🚀',
    gradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 55%, #fce7f3 100%)',
    border: '2px solid rgba(139,92,246,.28)',
    shadow: 'shadow-[0_4px_20px_rgba(139,92,246,.1)]',
    hoverShadow: 'hover:shadow-[0_16px_44px_rgba(139,92,246,.22)]',
    blobA: 'bg-violet-300/25',
    blobB: 'bg-fuchsia-300/20',
    badge: 'bg-violet-100 text-violet-900',
    title: 'text-violet-950',
    summary: 'text-violet-900/70',
    progressTrack: 'bg-violet-100/80',
    progressFill: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
    cta: 'bg-violet-50/90 text-violet-900',
    ctaHover: 'group-hover:bg-violet-500 group-hover:text-white',
    accent: 'linear-gradient(90deg, #8b5cf6, #c084fc)',
  },
  3: {
    emoji: '⭐',
    gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 55%, #ffedd5 100%)',
    border: '2px solid rgba(245,158,11,.28)',
    shadow: 'shadow-[0_4px_20px_rgba(245,158,11,.1)]',
    hoverShadow: 'hover:shadow-[0_16px_44px_rgba(245,158,11,.22)]',
    blobA: 'bg-amber-300/25',
    blobB: 'bg-orange-300/20',
    badge: 'bg-amber-100 text-amber-900',
    title: 'text-amber-950',
    summary: 'text-amber-900/70',
    progressTrack: 'bg-amber-100/80',
    progressFill: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    cta: 'bg-amber-50/90 text-amber-900',
    ctaHover: 'group-hover:bg-amber-500 group-hover:text-white',
    accent: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
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
    <NavigationLink
      href={`/math/ny/g${grade}`}
      className="group block h-full w-full no-underline"
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[20px] text-left transition-all duration-300 group-hover:-translate-y-1 ${theme.shadow} ${theme.hoverShadow}`}
        style={{
          background: theme.gradient,
          border: theme.border,
        }}
      >
      <div className="h-1 shrink-0" style={{ background: theme.accent }} />

      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${theme.blobA}`} />
      <div className={`pointer-events-none absolute -bottom-6 left-6 h-20 w-20 rounded-full blur-xl ${theme.blobB}`} />

      <div className="relative flex flex-1 flex-col px-5 py-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[26px] shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
            {theme.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[20px] font-extrabold leading-tight ${theme.title}`}>{label}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${theme.badge}`}>
                {lessonCount} 讲
              </span>
            </div>
            <p className={`mt-1 min-h-10 line-clamp-2 text-[12px] leading-relaxed font-medium ${theme.summary}`}>
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
          <span className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </div>
      </div>
      </div>
    </NavigationLink>
  )
}
