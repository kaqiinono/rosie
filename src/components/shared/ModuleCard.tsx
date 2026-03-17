'use client'

import NavigationLink from './NavigationLink'
import ArrowIcon from './ArrowIcon'
import type { ModuleCardData } from '@/utils/type'

const variantStyles = {
  math: {
    accent: 'bg-gradient-to-r from-math-from to-math-to',
    iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/15 dark:to-indigo-500/15',
    tag: 'text-indigo-800 bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300',
    statDot: 'bg-math-from',
    enter: 'bg-gradient-to-br from-blue-50 to-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-math-from group-hover:to-math-to group-hover:text-white',
    deco: 'bg-math-from',
  },
  english: {
    accent: 'bg-gradient-to-r from-eng-from to-eng-to',
    iconBg: 'bg-gradient-to-br from-emerald-100 to-cyan-100 dark:from-emerald-500/15 dark:to-cyan-500/15',
    tag: 'text-emerald-800 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300',
    statDot: 'bg-eng-from',
    enter: 'bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-eng-from group-hover:to-eng-to group-hover:text-white',
    deco: 'bg-eng-from',
  },
}

export default function ModuleCard({ data }: { data: ModuleCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink
      href={data.href}
      className="group relative block overflow-hidden rounded-[20px] border border-white/80 bg-white text-left shadow-[0_4px_24px_rgba(15,23,42,.06),0_1px_3px_rgba(15,23,42,.04)] transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(15,23,42,.1),0_4px_12px_rgba(15,23,42,.06)] dark:bg-slate-800 dark:border-white/6 dark:shadow-[0_4px_24px_rgba(0,0,0,.2)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,.35)]"
    >
      <div className={`h-[5px] transition-all duration-300 group-hover:h-1.5 ${s.accent}`} />

      <div className={`absolute -top-8 -right-5 h-30 w-30 rounded-full opacity-6 ${s.deco}`} />
      <div className={`absolute -bottom-5 -left-4 h-20 w-20 rounded-full opacity-6 ${s.deco}`} />

      <div className="relative flex flex-col gap-3.5 p-6">
        <div className="flex items-center justify-between">
          <div className={`flex h-[54px] w-[54px] items-center justify-center rounded-2xl text-[28px] transition-transform duration-300 group-hover:scale-108 group-hover:-rotate-4 ${s.iconBg}`}>
            {data.icon}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider uppercase ${s.tag}`}>
            {data.tag}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[22px] font-extrabold leading-tight">{data.title}</div>
          <p className="text-sm text-text-secondary leading-relaxed">{data.description}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.stats.map((stat) => (
            <span
              key={stat}
              className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-bold text-text-secondary dark:bg-slate-900 dark:border-white/6"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.statDot}`} />
              {stat}
            </span>
          ))}
        </div>

        <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 ${s.enter} ${s.enterHover}`}>
          {data.enterText}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-white/25">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </NavigationLink>
  )
}
