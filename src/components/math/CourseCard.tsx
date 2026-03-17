'use client'

import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import NavigationLink from '@/components/shared/NavigationLink'
import type { CourseCardData } from '@/utils/type'
import { cn } from '@/lib/utils'

const variantStyles = {
  blue: {
    sideBg: 'bg-gradient-to-br from-blue-100 to-blue-50',
    sideOverlay: 'bg-blue-500',
    num: 'bg-blue-500/12 text-blue-800',
    tag: 'blue' as const,
    enter: 'bg-blue-50 text-blue-800',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white group-hover:shadow-lg',
    deco: 'bg-blue-500',
  },
  amber: {
    sideBg: 'bg-gradient-to-br from-amber-100 to-amber-50',
    sideOverlay: 'bg-amber-500',
    num: 'bg-amber-500/12 text-amber-900',
    tag: 'amber' as const,
    enter: 'bg-amber-50 text-amber-900',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white group-hover:shadow-lg',
    deco: 'bg-amber-500',
  },
  violet: {
    sideBg: 'bg-gradient-to-br from-violet-100 to-violet-50',
    sideOverlay: 'bg-violet-500',
    num: 'bg-violet-500/12 text-violet-900',
    tag: 'violet' as const,
    enter: 'bg-violet-50 text-violet-900',
    enterHover: 'group-hover:bg-gradient-to-br group-hover:from-violet-500 group-hover:to-indigo-500 group-hover:text-white group-hover:shadow-lg',
    deco: 'bg-violet-500',
  },
}

export default function CourseCard({ data }: { data: CourseCardData }) {
  const s = variantStyles[data.variant]

  return (
    <NavigationLink href={data.href}>
      <Card className="group relative flex overflow-hidden border-white/80 bg-white transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1.5 hover:shadow-xl max-[500px]:flex-col">
        <div className={cn('absolute -top-6 -right-4 h-25 w-25 rounded-full opacity-4', s.deco)} />

        <div className={cn('relative flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden max-[500px]:h-15 max-[500px]:w-full max-[500px]:flex-row max-[500px]:justify-start max-[500px]:gap-2.5 max-[500px]:px-4', s.sideBg)}>
          <div className={cn('absolute inset-0 opacity-12', s.sideOverlay)} />
          <div className="relative z-1 text-[32px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-5">
            {data.icon}
          </div>
          <div className={cn('relative z-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold tracking-wider', s.num)}>
            {data.lectureNum}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-4.5">
          <div className="text-lg font-extrabold leading-tight">{data.title}</div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{data.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag) => (
              <Badge key={tag} variant={s.tag} className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>

          <div className={cn('mt-0.5 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-all duration-200', s.enter, s.enterHover)}>
            开始学习
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </NavigationLink>
  )
}
