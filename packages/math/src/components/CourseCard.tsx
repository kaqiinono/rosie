'use client'

import { NavigationLink } from '@rosie/ui'
import type { CourseCardData } from '@rosie/core'

const variantStyles = {
  blue: {
    sideBg: 'bg-gradient-to-br from-blue-100 to-blue-50',
    sideOverlay: 'bg-blue-500',
    num: 'bg-blue-500/12 text-blue-800',
    tag: 'bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300',
    deco: 'bg-blue-500',
  },
  amber: {
    sideBg: 'bg-gradient-to-br from-amber-100 to-amber-50',
    sideOverlay: 'bg-amber-500',
    num: 'bg-amber-500/12 text-amber-900',
    tag: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
    deco: 'bg-amber-500',
  },
  violet: {
    sideBg: 'bg-gradient-to-br from-violet-100 to-violet-50',
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
      className="group relative flex h-full overflow-hidden rounded-2xl border border-white/80 bg-white text-left shadow-[0_4px_20px_rgba(15,23,42,.05),0_1px_3px_rgba(15,23,42,.04)] transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1 hover:scale-[1.005] hover:shadow-[0_12px_36px_rgba(15,23,42,.1),0_4px_12px_rgba(15,23,42,.05)] dark:bg-slate-800 dark:border-white/6 max-[500px]:flex-col"
    >
      <div className={`absolute -top-6 -right-4 h-20 w-20 rounded-full opacity-4 ${s.deco}`} />
      <div className={`absolute -bottom-4 right-8 h-12 w-12 rounded-full opacity-4 ${s.deco}`} />

      <div className={`relative flex w-16 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden max-[500px]:h-12 max-[500px]:w-full max-[500px]:flex-row max-[500px]:justify-start max-[500px]:gap-2 max-[500px]:px-3.5 ${s.sideBg}`}>
        <div className={`absolute inset-0 opacity-12 ${s.sideOverlay}`} />
        <div className="relative z-1 text-[26px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-5">
          {data.icon}
        </div>
        <div className={`relative z-1 rounded-md px-1.5 py-px text-[10px] font-extrabold tracking-wider ${s.num}`}>
          {data.lectureNum}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3.5 py-3 max-[500px]:py-2.5">
        <div className="text-[17px] font-extrabold leading-tight">{data.title}</div>
        <p className="line-clamp-2 text-[12px] leading-snug text-text-secondary">{data.description}</p>

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
