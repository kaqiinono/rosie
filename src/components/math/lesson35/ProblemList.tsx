'use client'

import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson35-data'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Check, ChevronRight } from 'lucide-react'

interface ProblemListProps {
  problems: Problem[]
  solved: Record<string, boolean>
  setName: string
  onOpen: (setName: string, id: string) => void
  onFilterByTag?: (tag: string) => void
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList({
  problems,
  solved,
  setName,
  onOpen,
  onFilterByTag,
  showSource,
  sourceLabel,
}: ProblemListProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p, i) => {
        const done = solved[p.id]
        return (
          <Card
            key={p.id}
            onClick={() => onOpen(setName, p.id)}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 border-[1.5px] p-3 transition-all hover:shadow-lg',
              done ? 'border-app-green' : 'border-transparent hover:border-border-light'
            )}
          >
            <div
              className={cn(
                'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done ? 'bg-app-green-light text-app-green-dark' : 'bg-app-blue-light text-app-blue-dark'
              )}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{p.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                <Badge
                  onClick={e => {
                    e.stopPropagation()
                    onFilterByTag?.(p.tag)
                  }}
                  className={cn(
                    'cursor-pointer px-2 py-px text-[10px] font-semibold',
                    TAG_STYLE[p.tag] || 'bg-gray-100 text-gray-600'
                  )}
                  title={`查看所有${p.tagLabel}题目`}
                >
                  {p.tagLabel} {onFilterByTag ? '🔍' : ''}
                </Badge>
                {showSource && sourceLabel && (
                  <Badge variant="violet" className="px-2 py-px text-[10px] font-semibold">
                    {sourceLabel}
                  </Badge>
                )}
              </div>
            </div>
            {done ? (
              <Check className="h-5 w-5 shrink-0 text-app-green" />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
            )}
          </Card>
        )
      })}
      {problems.length === 0 && (
        <div className="col-span-full py-6 text-center text-[13px] text-text-muted">
          没有符合筛选条件的题目
        </div>
      )}
    </div>
  )
}
