'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { STORAGE_KEYS } from '@/utils/constant'
import type { ProblemSet } from '@/utils/type'
import type { LessonContextType } from './createLessonProvider'

type SidebarSection = {
  key: string
  path: string
  icon: string
  label: string
  noProgress?: boolean
}

type SidebarExtraLink = {
  key: string
  path: string
  icon: string
  label: string
}

type SidebarConfig = {
  basePath: string
  sections: readonly SidebarSection[]
  /** Active-state class for sidebar links, e.g. 'bg-yellow-light font-bold text-yellow-dark' */
  activeClass: string
  /** Extra links shown between home and sections (e.g. magic book) */
  extraLinks?: readonly SidebarExtraLink[]
}

type Props = {
  config: SidebarConfig
  problems: ProblemSet
  useLessonContext: () => LessonContextType
}

export default function LessonSidebar({ config, problems, useLessonContext }: Props) {
  const pathname = usePathname()
  const { solveCount, wrongIds } = useLessonContext()
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

  function isActive(key: string): boolean {
    if (key === 'home') return pathname === config.basePath
    const extra = config.extraLinks?.find(l => l.key === key)
    if (extra) return pathname === extra.path
    return pathname.startsWith(`${config.basePath}/${key}`)
  }

  const allIconLinks = [
    { key: 'home', path: config.basePath, icon: '🏠', label: '首页' },
    ...(config.extraLinks ?? []),
    ...config.sections,
  ]

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
              href={config.basePath}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium no-underline transition-all ${
                isActive('home')
                  ? config.activeClass
                  : 'text-text-secondary hover:bg-gray-50'
              }`}
            >
              <span className="w-5 shrink-0 text-center text-base">🏠</span>
              首页
            </Link>

            {config.extraLinks?.map(link => (
              <Link
                key={link.key}
                href={link.path}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium no-underline transition-all ${
                  isActive(link.key)
                    ? config.activeClass
                    : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-base">{link.icon}</span>
                {link.label}
              </Link>
            ))}

            <div className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              学习模块
            </div>
            {config.sections.map(s => (
              <Link
                key={s.key}
                href={s.path}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium no-underline transition-all ${
                  isActive(s.key)
                    ? config.activeClass
                    : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-base">{s.icon}</span>
                {s.label}
                {!s.noProgress && <span className="ml-auto text-[10px] text-text-muted">{getProgress(s.key)}</span>}
              </Link>
            ))}
          </div>
        )}

        {collapsed && (
          <div className="flex flex-1 flex-col items-center gap-1 py-2">
            {allIconLinks.map(s => (
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
