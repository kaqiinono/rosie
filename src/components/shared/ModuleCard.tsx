'use client'

import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import NavigationLink from './NavigationLink'
import type { ModuleCardData } from '@/utils/type'
import { cn } from '@/lib/utils'

const variantStyles = {
  math: {
    accent: 'from-blue-500 to-indigo-500',
    iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100',
    tag: 'blue' as const,
    statDot: 'bg-blue-500',
    enter: 'bg-blue-50 text-blue-800',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white group-hover:shadow-lg',
    deco: 'bg-blue-500',
  },
  english: {
    accent: 'from-emerald-500 to-cyan-500',
    iconBg: 'bg-gradient-to-br from-emerald-100 to-cyan-100',
    tag: 'green' as const,
    statDot: 'bg-emerald-500',
    enter: 'bg-emerald-50 text-emerald-800',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-cyan-500 group-hover:text-white group-hover:shadow-lg',
    deco: 'bg-emerald-500',
  },
}

export default function ModuleCard({ data }: { data: ModuleCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink href={data.href}>
      <Card className="group relative overflow-hidden border-white/80 bg-white transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1.5 hover:shadow-xl">
        <div className={cn('h-1.5 bg-gradient-to-r transition-all duration-300 group-hover:h-2', s.accent)} />

        <div className={cn('absolute -top-8 -right-5 h-30 w-30 rounded-full opacity-6', s.deco)} />
        <div className={cn('absolute -bottom-5 -left-4 h-20 w-20 rounded-full opacity-6', s.deco)} />

        <div className="relative flex flex-col gap-3.5 p-5">
          <div className="flex items-center justify-between">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-4', s.iconBg)}>
              {data.icon}
            </div>
            <Badge variant={s.tag} className="text-[11px] font-extrabold tracking-wider uppercase">
              {data.tag}
            </Badge>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xl font-extrabold leading-tight">{data.title}</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{data.description}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {data.stats.map((stat) => (
              <Badge key={stat} variant="secondary" className="gap-1 border-slate-100 font-bold">
                <span className={cn('h-1.5 w-1.5 rounded-full', s.statDot)} />
                {stat}
              </Badge>
            ))}
          </div>

          <div className={cn('flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200', s.enter, s.enterHover)}>
            {data.enterText}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Card>
    </NavigationLink>
  )
}
