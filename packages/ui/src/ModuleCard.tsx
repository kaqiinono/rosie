'use client'

import NavigationLink from './NavigationLink'
import ArrowIcon from './ArrowIcon'
import type { ModuleCardData } from '@rosie/core'

const variantStyles = {
  math: {
    accent: 'bg-indigo-500',
    iconBg: 'bg-indigo-100',
    tag: 'bg-indigo-100 text-indigo-800',
    statDot: 'bg-indigo-500',
    enter: 'bg-indigo-100 text-indigo-800',
    enterHover: 'group-hover:bg-indigo-500 group-hover:text-white',
    deco: 'bg-indigo-500',
  },
  english: {
    accent: 'bg-emerald-600',
    iconBg: 'bg-emerald-100',
    tag: 'bg-emerald-100 text-emerald-800',
    statDot: 'bg-emerald-600',
    enter: 'bg-emerald-100 text-emerald-800',
    enterHover: 'group-hover:bg-emerald-600 group-hover:text-white',
    deco: 'bg-emerald-600',
  },
  reading: {
    accent: 'bg-orange-600',
    iconBg: 'bg-orange-100',
    tag: 'bg-orange-100 text-orange-800',
    statDot: 'bg-orange-600',
    enter: 'bg-orange-100 text-orange-800',
    enterHover: 'group-hover:bg-orange-600 group-hover:text-white',
    deco: 'bg-orange-600',
  },
  today: {
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-100',
    tag: 'bg-amber-100 text-amber-800',
    statDot: 'bg-amber-500',
    enter: 'bg-amber-100 text-amber-800',
    enterHover: 'group-hover:bg-amber-400 group-hover:text-amber-950',
    deco: 'bg-amber-500',
  },
  calc: {
    accent: 'bg-violet-500',
    iconBg: 'bg-violet-100',
    tag: 'bg-violet-100 text-violet-800',
    statDot: 'bg-violet-500',
    enter: 'bg-violet-100 text-violet-800',
    enterHover: 'group-hover:bg-violet-500 group-hover:text-white',
    deco: 'bg-violet-500',
  },
}

export default function ModuleCard({ data }: { data: ModuleCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink
      href={data.href}
      className="group border-kid-line shadow-sticker ease-spring hover:border-kid-line-strong hover:shadow-sticker-lg relative block overflow-hidden rounded-3xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className={`h-[5px] transition-all duration-300 group-hover:h-1.5 ${s.accent}`} />

      <div className={`absolute -top-8 -right-5 h-30 w-30 rounded-full opacity-10 ${s.deco}`} />

      <div className="relative flex flex-col gap-3.5 p-6">
        <div className="flex items-center justify-between">
          <div
            className={`flex h-[54px] w-[54px] items-center justify-center rounded-2xl text-[28px] transition-transform duration-300 group-hover:scale-108 group-hover:-rotate-4 ${s.iconBg}`}
          >
            {data.icon}
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider uppercase ${s.tag}`}
          >
            {data.tag}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[22px] leading-tight font-extrabold">{data.title}</div>
          <p className="text-text-secondary text-sm leading-relaxed">{data.description}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.stats.map((stat) => (
            <span
              key={stat}
              className="border-kid-line bg-kid-paper text-text-secondary flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-bold"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.statDot}`} />
              {stat}
            </span>
          ))}
        </div>

        <div
          className={`flex items-center justify-between rounded-full px-4 py-3 text-sm font-bold transition-all duration-200 ${s.enter} ${s.enterHover}`}
        >
          {data.enterText}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-white/25">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </NavigationLink>
  )
}
