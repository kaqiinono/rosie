'use client'

import NavigationLink from '@/components/shared/NavigationLink'
import ArrowIcon from '@/components/shared/ArrowIcon'
import type { CourseCardData } from '@/utils/type'

const variantStyles = {
  blue: {
    sideBg: 'bg-gradient-to-br from-blue-100 to-blue-50',
    sideOverlay: 'bg-blue-500',
    num: 'bg-blue-500/12 text-blue-800',
    tag: 'bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300',
    enter: 'bg-blue-50 text-blue-800',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white',
    deco: 'bg-blue-500',
  },
  amber: {
    sideBg: 'bg-gradient-to-br from-amber-100 to-amber-50',
    sideOverlay: 'bg-amber-500',
    num: 'bg-amber-500/12 text-amber-900',
    tag: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
    enter: 'bg-amber-50 text-amber-900',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white',
    deco: 'bg-amber-500',
  },
  violet: {
    sideBg: 'bg-gradient-to-br from-violet-100 to-violet-50',
    sideOverlay: 'bg-violet-500',
    num: 'bg-violet-500/12 text-violet-900',
    tag: 'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300',
    enter: 'bg-violet-50 text-violet-900',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-violet-500 group-hover:to-indigo-500 group-hover:text-white',
    deco: 'bg-violet-500',
  },
}

export default function CourseCard({ data }: { data: CourseCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink
      href={data.href}
      className="group relative flex overflow-hidden rounded-[18px] border border-white/80 bg-white text-left shadow-[0_4px_20px_rgba(15,23,42,.05),0_1px_3px_rgba(15,23,42,.04)] transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1.5 hover:scale-[1.005] hover:shadow-[0_16px_44px_rgba(15,23,42,.1),0_4px_12px_rgba(15,23,42,.05)] dark:bg-slate-800 dark:border-white/6 max-[500px]:flex-col"
    >
      <div className={`absolute -top-6 -right-4 h-25 w-25 rounded-full opacity-4 ${s.deco}`} />
      <div className={`absolute -bottom-4 right-8 h-15 w-15 rounded-full opacity-4 ${s.deco}`} />

      <div className={`relative flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden max-[500px]:h-15 max-[500px]:w-full max-[500px]:flex-row max-[500px]:justify-start max-[500px]:gap-2.5 max-[500px]:px-4 ${s.sideBg}`}>
        <div className={`absolute inset-0 opacity-12 ${s.sideOverlay}`} />
        <div className="relative z-1 text-[32px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-5">
          {data.icon}
        </div>
        <div className={`relative z-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold tracking-wider ${s.num}`}>
          {data.lectureNum}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-4.5">
        <div className="text-[19px] font-extrabold leading-tight">{data.title}</div>
        <p className="text-[13px] leading-relaxed text-text-secondary">{data.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <span key={tag} className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.tag}`}>
              {tag}
            </span>
          ))}
        </div>

        <div className={`mt-0.5 flex items-center justify-between rounded-[10px] px-3.5 py-2.5 text-[13px] font-bold transition-all duration-200 ${s.enter} ${s.enterHover}`}>
          开始学习
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowIcon size={13} />
          </span>
        </div>
      </div>
    </NavigationLink>
  )
}
