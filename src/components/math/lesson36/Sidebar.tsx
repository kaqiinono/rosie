'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { STORAGE_KEYS } from '@/utils/constant'
import type { ProblemSet } from '@/utils/type'
import { useLesson36 } from './Lesson36Provider'

const BASE = '/math/ny/36'

const SECTIONS = [
  { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
  { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
  { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
  { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
  { key: 'mistakes', path: `${BASE}/mistakes`, icon: '📕', label: '错题本' },
] as const

interface SidebarProps {
  problems: ProblemSet
}

export default function Sidebar({ problems }: SidebarProps) {
  const pathname = usePathname()
  const { solveCount, wrongIds } = useLesson36()
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(STORAGE_KEYS.MATH_SIDEBAR_COLLAPSED, false)
  const totalAll = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const masteredAll = Object.values(solveCount).filter(c => c >= 3).length

  function getProgress(key: string): string {
    if (key === 'alltest') return `${masteredAll}/${totalAll}`
    if (key === 'mistakes') return `${wrongIds.size} 题`
    const list = problems[key as keyof ProblemSet]
    if (!list) return '0/0'
    const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
    return `${mastered}/${list.length}`
  }

  function isActive(key: string) {
    if (key === 'home') return pathname === BASE
    return pathname.startsWith(`${BASE}/${key}`)
  }

  return (
    <div
      className={`sticky top-14 hidden h-[calc(100vh-56px)] shrink-0 overflow-hidden border-r border-border-light bg-white transition-[width] duration-200 md:block lg:hidden xl:block ${
        collapsed ? 'w-[48px]' : 'w-[240px]'
      }`}
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex shrink-0 items-center justify-center border-b border-border-light py-3 text-text-muted transition-colors hover:bg-gray-50 hover:text-text-primary"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <span className="text-lg">☰</span>
          ) : (
            <span className="text-sm">{`<<`} </span>
          )}
        </button>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              导航
            </div>
            <Link
              href={BASE}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium no-underline transition-all ${
                isActive('home')
                  ? 'bg-blue-50 font-bold text-app-blue-dark'
                  : 'text-text-secondary hover:bg-gray-50'
              }`}
            >
              <span className="w-5 shrink-0 text-center text-base">🏠</span>
              首页
            </Link>

            <div className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              学习模块
            </div>
            {SECTIONS.map(s => (
              <Link
                key={s.key}
                href={s.path}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium no-underline transition-all ${
                  isActive(s.key)
                    ? 'bg-blue-50 font-bold text-app-blue-dark'
                    : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-base">{s.icon}</span>
                {s.label}
                <span className="ml-auto text-[10px] text-text-muted">{getProgress(s.key)}</span>
              </Link>
            ))}
          </div>
        )}

        {collapsed && (
          <div className="flex flex-1 flex-col items-center gap-1 py-2">
            <Link
              href={BASE}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors hover:bg-gray-100"
              title="首页"
            >
              🏠
            </Link>
            {SECTIONS.map(s => (
              <Link
                key={s.key}
                href={s.path}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors hover:bg-gray-100"
                title={s.label}
              >
                {s.icon}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
