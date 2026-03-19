'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ProblemSet, Problem } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'
import { useLesson35 } from './Lesson35Provider'

const BASE = '/math/ny/35'
const PATH_MAP: Record<string, string> = {
  home: BASE,
  lesson: `${BASE}/lesson`,
  homework: `${BASE}/homework`,
  workbook: `${BASE}/workbook`,
  alltest: `${BASE}/alltest`,
  pretest: `${BASE}/pretest`,
  mistakes: `${BASE}/mistakes`,
}

interface AppHeaderProps {
  problems: ProblemSet
}

export default function AppHeader({ problems }: AppHeaderProps) {
  const pathname = usePathname()
  const { solveCount } = useLesson35()

  const allIds = new Set((Object.values(problems) as Problem[][]).flatMap(l => l.map(p => p.id)))
  const total = allIds.size
  const mastered = [...allIds].filter(id => (solveCount[id] ?? 0) >= 3).length

  function isActive(key: string) {
    if (key === 'home') return pathname === BASE
    return pathname.startsWith(PATH_MAP[key])
  }

  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-border-light bg-white/95 backdrop-blur-sm shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      {/* pr-[168px] on mobile reserves space for the fixed AccountBar (≈150px + right-4 gap) */}
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-2 pl-3 pr-[168px] sm:h-14 sm:gap-3 sm:pl-5 sm:pr-5">

        {/* Back button — icon-only circle on mobile, pill with text on sm+ */}
        <Link
          href="/math"
          className="flex shrink-0 items-center justify-center rounded-full border border-gray-200 text-text-muted no-underline transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-text-secondary
            h-8 w-8
            sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5"
        >
          <span className="text-[13px] font-semibold leading-none">←</span>
          <span className="hidden sm:inline text-[12px] font-medium">课程列表</span>
        </Link>

        {/* Logo — short on mobile, full on sm+ */}
        <Link href={BASE} className="shrink-0 no-underline">
          <span className="text-[15px] font-bold text-text-primary sm:text-[17px]">
            🐦{' '}
            <span className="text-yellow-dark">归一</span>
            <span className="hidden min-[480px]:inline">问题探险</span>
          </span>
        </Link>

        {/* Progress chip */}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-text-secondary sm:gap-1.5 sm:px-3 sm:text-[12px]">
          🦋{' '}
          <span className="text-app-green-dark">{mastered}</span>
          <span className="text-text-muted">/{total}</span>
        </div>

        {/* Nav links — only visible between lg and xl (sidebar hidden at that breakpoint) */}
        <div className="hidden gap-0 overflow-x-auto scrollbar-none lg:flex xl:hidden">
          {NAV_PAGES.map(p => {
            const active = isActive(p.key)
            return (
              <Link
                key={p.key}
                href={PATH_MAP[p.key] || BASE}
                className={`flex h-12 items-center whitespace-nowrap px-3 text-[13px] font-medium no-underline transition-all sm:h-14 ${
                  active ? 'text-yellow-dark' : 'text-text-muted hover:text-text-secondary'
                }`}
                style={{ borderBottom: `2px solid ${active ? '#f59e0b' : 'transparent'}` }}
              >
                {p.icon} {p.label}
              </Link>
            )
          })}
        </div>

        <div className="flex-1" />
      </div>
    </div>
  )
}
