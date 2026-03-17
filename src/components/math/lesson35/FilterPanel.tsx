'use client'

import type { Problem, ProblemSet } from '@/utils/type'
import { SOURCE_LABELS } from '@/utils/constant'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Check, ChevronRight } from 'lucide-react'

interface Filters {
  source: Set<string>
  type: Set<string>
}

interface FilterPanelProps {
  problems: ProblemSet
  solved: Record<string, boolean>
  filters: Filters
  onToggleFilter: (axis: 'source' | 'type', value: string) => void
  onOpenProblem: (set: string, id: string) => void
}

const SOURCE_BTNS = [
  { key: 'lesson', label: '📖 课堂' },
  { key: 'homework', label: '✏️ 课后' },
  { key: 'workbook', label: '📚 练习册' },
  { key: 'pretest', label: '📝 课前测' },
]

const TYPE_BTNS = [
  { key: 'type1', label: '基础归一' },
  { key: 'type2', label: '直接倍比' },
  { key: 'type3', label: '双归一' },
  { key: 'type4', label: '反向归一' },
  { key: 'type5', label: '变化归一' },
]

const TAG_COLORS: Record<string, string> = {
  type1: 'bg-app-blue-light text-app-blue-dark',
  type2: 'bg-app-green-light text-app-green-dark',
  type3: 'bg-app-purple-light text-app-purple-dark',
  type4: 'bg-app-orange-light text-app-orange',
  type5: 'bg-app-red-light text-app-red',
}

export default function FilterPanel({ problems, solved, filters, onToggleFilter, onOpenProblem }: FilterPanelProps) {
  const all: { p: Problem; setName: string; idx: number }[] = []
  ;(Object.entries(problems) as [string, Problem[]][]).forEach(([setName, list]) => {
    list.forEach((p, i) => all.push({ p, setName, idx: i }))
  })

  const filtered = all.filter(
    ({ p, setName }) => filters.source.has(setName) && filters.type.has(p.tag),
  )
  const total = filtered.length
  const done = filtered.filter(({ p }) => solved[p.id]).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div>
      {/* Filter header */}
      <Card className="mb-3 border border-[#e879f9] bg-gradient-to-br from-[#fdf4ff] to-[#f3e8ff] p-4">
        <div className="mb-1.5 text-[15px] font-extrabold text-[#7e22ce]">🎯 综合测试题库</div>
        <div className="mb-2.5 text-xs text-[#6b21a8]">全部29道题 · 多选筛选 · 按题型/来源练习</div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">📂 来源筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_BTNS.map(b => (
              <Button
                key={b.key}
                variant={filters.source.has(b.key) ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToggleFilter('source', b.key)}
                className={cn(
                  'rounded-full text-[11px] font-semibold',
                  filters.source.has(b.key)
                    ? 'border-[#a855f7] bg-[#a855f7] text-white hover:bg-[#9333ea]'
                    : 'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce] hover:bg-[#f3e8ff]'
                )}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-1.5 text-[11px] font-bold text-[#6b21a8]">🏷️ 题型筛选（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_BTNS.map(b => (
              <Button
                key={b.key}
                variant={filters.type.has(b.key) ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToggleFilter('type', b.key)}
                className={cn(
                  'rounded-full text-[11px] font-semibold',
                  filters.type.has(b.key)
                    ? 'border-[#a855f7] bg-[#a855f7] text-white hover:bg-[#9333ea]'
                    : 'border-[#d8b4fe] bg-[#fdf4ff] text-[#7e22ce] hover:bg-[#f3e8ff]'
                )}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Progress
            value={done}
            max={total}
            className="h-[5px] flex-1 bg-[#e9d5ff]"
            indicatorClassName="bg-[#a855f7]"
          />
          <div className="text-[11px] font-bold text-[#6b21a8]">
            显示 {total} 题，已完成 {done} 题
          </div>
        </div>
      </Card>

      {/* Filtered problem list with source labels */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ p, setName, idx }) => {
          const d = solved[p.id]
          const srcLabel = SOURCE_LABELS[setName] || setName
          return (
            <Card
              key={p.id}
              onClick={() => onOpenProblem(setName, p.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 border-[1.5px] p-3 transition-all hover:shadow-lg',
                d ? 'border-app-green' : 'border-transparent hover:border-border-light'
              )}
            >
              <div
                className={cn(
                  'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  d ? 'bg-app-green-light text-app-green-dark' : 'bg-app-blue-light text-app-blue-dark'
                )}
              >
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{p.title}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <Badge className={cn('px-2 py-px text-[10px] font-semibold', TAG_COLORS[p.tag] || 'bg-gray-100 text-gray-600')}>
                    {p.tagLabel}
                  </Badge>
                  <Badge variant="violet" className="px-2 py-px text-[10px] font-semibold">
                    {srcLabel}
                  </Badge>
                </div>
              </div>
              {d ? (
                <Check className="h-5 w-5 shrink-0 text-app-green" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
              )}
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-6 text-center text-[13px] text-text-muted">
            没有符合筛选条件的题目
          </div>
        )}
      </div>
    </div>
  )
}
