'use client'

import type { PageName, ProblemSet } from '@/utils/type'
import { PROBLEM_TYPES, TYPE_STYLE } from '@/utils/lesson35-data'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface HomePageProps {
  problems: ProblemSet
  solved: Record<string, boolean>
  onNavigate: (page: PageName, filterType?: string) => void
}

interface ModuleItem {
  key: string
  icon: string
  bg: string
  title: string
  desc: string
  titleColor?: string
  borderColor?: string
  arrowColor?: string
  progColor?: string
}

const MODULES: ModuleItem[] = [
  { key: 'lesson', icon: '📖', bg: 'bg-app-blue-light', title: '课堂讲解', desc: '例题1-6 · 归一+双归一+变化' },
  { key: 'homework', icon: '✏️', bg: 'bg-app-green-light', title: '课后巩固', desc: '巩固1-6 · 强化练习' },
  { key: 'workbook', icon: '📚', bg: 'bg-app-purple-light', title: '练习册闯关', desc: '闯关1-12 · 综合挑战' },
  { key: 'pretest', icon: '📝', bg: 'bg-yellow-light', title: '课前测', desc: '5道摸底题 · 检验起始水平', titleColor: 'text-[#92400e]', borderColor: 'border-[#fde68a]', arrowColor: 'text-yellow', progColor: 'bg-yellow' },
]

export default function HomePage({ problems, solved, onNavigate }: HomePageProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const doneAll = Object.keys(solved).length

  function getProgress(key: string) {
    if (key === 'alltest') {
      return { done: doneAll, total: totalAll }
    }
    const list = problems[key as keyof ProblemSet]
    if (!list) return { done: 0, total: 0 }
    return { done: list.filter(p => solved[p.id]).length, total: list.length }
  }

  return (
    <div>
      {/* Hero */}
      <Card className="relative mb-5 overflow-hidden border-none bg-gradient-to-br from-yellow-light via-[#fde68a] to-[#fbbf24] p-6 shadow-none">
        <div className="pointer-events-none absolute -right-2.5 -top-2.5 text-[90px] opacity-[0.12] rotate-[15deg]">
          🎯
        </div>
        <h1 className="mb-1.5 text-2xl font-extrabold text-[#78350f]">归一问题 🎯</h1>
        <p className="text-[13px] leading-relaxed text-[#92400e]">
          第35讲 · 一年级目标班<br />学会用倍比图解决归一问题！
        </p>
      </Card>

      {/* 5 Problem Types */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold">🧠 归一问题 · 5大题型</div>
          <div className="mb-3 text-[13px] leading-relaxed text-text-secondary">
            <strong className="text-text-primary">核心本质：</strong>归一问题围绕<strong className="text-text-primary">总量、份数、每份数</strong>三者关系。
            <code className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">总量 = 份数 × 每份数</code>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_TYPES.map(t => {
              const style = TYPE_STYLE[t.tag]
              return (
                <div
                  key={t.tag}
                  onClick={() => onNavigate('alltest', t.tag)}
                  className={cn(
                    'cursor-pointer rounded-r-lg border-l-3 p-3 transition-all hover:shadow-md',
                    style.bg, style.border
                  )}
                >
                  <div className={cn('mb-1 flex items-center justify-between text-xs font-bold', style.titleColor)}>
                    {t.label}
                    <Badge variant="secondary" className="text-[10px] opacity-60">点击查看→</Badge>
                  </div>
                  <div className={cn('text-xs leading-relaxed', style.textColor)}>
                    {t.desc}
                    <em className="mt-0.5 block opacity-80">{t.example}</em>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-app-purple-light p-3">
            <span className="shrink-0 text-base">⭐</span>
            <span className="text-xs leading-relaxed text-app-purple-dark">
              万能口诀：<strong>先归一（÷份数）→ 找每份量 → 再求多（×份数）</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="mb-2.5 text-[13px] font-bold text-text-secondary">📂 学习模块</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(m => {
          const prog = getProgress(m.key)
          const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0
          return (
            <Card
              key={m.key}
              onClick={() => onNavigate(m.key as PageName)}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-2 p-4 transition-all hover:-translate-y-px hover:shadow-lg active:scale-[0.98]',
                m.borderColor || 'border-transparent'
              )}
            >
              <div className={cn('flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-[22px]', m.bg)}>
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-bold', m.titleColor)}>{m.title}</div>
                <div className="mb-1 text-xs text-text-muted">{m.desc}</div>
                <div className="flex items-center gap-1.5">
                  <Progress
                    value={prog.done}
                    max={prog.total}
                    className="h-1 flex-1 bg-gray-100"
                    indicatorClassName={m.progColor || 'bg-app-green'}
                  />
                  <div className="whitespace-nowrap text-[11px] text-text-muted">
                    {prog.done}/{prog.total}
                  </div>
                </div>
              </div>
              <ChevronRight className={cn('h-5 w-5 shrink-0', m.arrowColor || 'text-text-muted')} />
            </Card>
          )
        })}
        {/* All-test wide card */}
        <Card
          onClick={() => onNavigate('alltest')}
          className="flex cursor-pointer items-center gap-3 border-2 border-[#e879f9] p-4 transition-all hover:-translate-y-px hover:shadow-lg active:scale-[0.98] sm:col-span-2 xl:col-span-3"
        >
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#fdf4ff] text-[22px]">
            🎯
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#7e22ce]">综合测试题库</div>
            <div className="mb-1 text-xs text-text-muted">全部题目 · 按题型/来源筛选 · 综合训练</div>
            <div className="flex items-center gap-1.5">
              <Progress
                value={doneAll}
                max={totalAll}
                className="h-1 flex-1 bg-gray-100"
                indicatorClassName="bg-[#a855f7]"
              />
              <div className="whitespace-nowrap text-[11px] text-text-muted">
                {doneAll}/{totalAll}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[#a855f7]" />
        </Card>
      </div>
    </div>
  )
}
