'use client'

import type { PageName, ProblemSet } from '@/utils/type'

interface SidebarProps {
  currentPage: PageName
  solved: Record<string, boolean>
  problems: ProblemSet
  onNavigate: (page: PageName) => void
}

const SECTIONS = [
  { key: 'lesson', icon: '📖', label: '课堂讲解' },
  { key: 'homework', icon: '✏️', label: '课后巩固' },
  { key: 'workbook', icon: '📚', label: '练习册' },
  { key: 'alltest', icon: '🎯', label: '综合题库' },
  { key: 'pretest', icon: '📝', label: '课前测' },
] as const

export default function Sidebar({ currentPage, solved, problems, onNavigate }: SidebarProps) {
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const doneAll = Object.keys(solved).length

  function getProgress(key: string): string {
    if (key === 'alltest') return `${doneAll}/${totalAll}`
    const list = problems[key as keyof ProblemSet]
    if (!list) return '0/0'
    const d = list.filter(p => solved[p.id]).length
    return `${d}/${list.length}`
  }

  return (
    <div className="sticky top-14 hidden h-[calc(100vh-56px)] w-[240px] shrink-0 overflow-y-auto border-r border-border-light bg-white px-3 py-4 md:block lg:hidden xl:block">
      <div className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        导航
      </div>
      <button
        onClick={() => onNavigate('home')}
        className={`mb-1 flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-none px-3 py-2.5 text-[13px] font-medium transition-all ${
          currentPage === 'home'
            ? 'bg-yellow-light font-bold text-yellow-dark'
            : 'bg-transparent text-text-secondary hover:bg-gray-50'
        }`}
      >
        <span className="w-5 shrink-0 text-center text-base">🏠</span>
        首页
      </button>

      <div className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        学习模块
      </div>
      {SECTIONS.map(s => {
        const active = currentPage === s.key
        return (
          <button
            key={s.key}
            onClick={() => onNavigate(s.key as PageName)}
            className={`mb-1 flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-none px-3 py-2.5 text-[13px] font-medium transition-all ${
              active
                ? 'bg-yellow-light font-bold text-yellow-dark'
                : 'bg-transparent text-text-secondary hover:bg-gray-50'
            }`}
          >
            <span className="w-5 shrink-0 text-center text-base">{s.icon}</span>
            {s.label}
            <span className="ml-auto text-[10px] text-text-muted">{getProgress(s.key)}</span>
          </button>
        )
      })}
    </div>
  )
}
