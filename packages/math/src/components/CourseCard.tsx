'use client'

import { NavigationLink } from '@rosie/ui'
import type { CourseCardData } from '@rosie/core'

const variantStyles = {
  blue: {
    sideBg: 'bg-blue-50 ',
    sideOverlay: 'bg-blue-500',
    num: 'bg-blue-500/12 text-blue-800',
    tag: 'bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300',
    deco: 'bg-blue-500',
  },
  amber: {
    sideBg: 'bg-amber-50 ',
    sideOverlay: 'bg-amber-500',
    num: 'bg-amber-500/12 text-amber-900',
    tag: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
    deco: 'bg-amber-500',
  },
  violet: {
    sideBg: 'bg-violet-50 ',
    sideOverlay: 'bg-violet-500',
    num: 'bg-violet-500/12 text-violet-900',
    tag: 'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300',
    deco: 'bg-violet-500',
  },
}

export default function CourseCard({ data }: { data: CourseCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink
      href={data.href}
      className="group shadow-sticker-sm hover:shadow-sticker relative flex h-full overflow-hidden rounded-2xl border border-white/80 bg-white text-left transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1 hover:scale-[1.005] max-[500px]:flex-col dark:border-white/6 dark:bg-slate-800"
    >
      <div className={`absolute -top-6 -right-4 h-20 w-20 rounded-full opacity-4 ${s.deco}`} />
      <div className={`absolute right-8 -bottom-4 h-12 w-12 rounded-full opacity-4 ${s.deco}`} />

      <div
        className={`relative flex w-16 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden max-[500px]:h-12 max-[500px]:w-full max-[500px]:flex-row max-[500px]:justify-start max-[500px]:gap-2 max-[500px]:px-3.5 ${s.sideBg}`}
      >
        <div className={`absolute inset-0 opacity-12 ${s.sideOverlay}`} />
        <div className="relative z-1 text-[26px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-5">
          {data.icon}
        </div>
        <div
          className={`relative z-1 rounded-md px-1.5 py-px text-[10px] font-extrabold tracking-wider ${s.num}`}
        >
          {data.lectureNum}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3.5 py-3 max-[500px]:py-2.5">
        <div className="text-[17px] leading-tight font-extrabold">{data.title}</div>
        <p className="text-text-secondary line-clamp-2 text-[12px] leading-snug">
          {data.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <span key={tag} className={`rounded-md px-1.5 py-px text-[10px] font-bold ${s.tag}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </NavigationLink>
  )
}
