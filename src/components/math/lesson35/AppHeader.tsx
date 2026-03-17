'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ProblemSet } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'

const BASE = '/math/ny/35'
const PATH_MAP: Record<string, string> = {
  home: BASE,
  lesson: `${BASE}/lesson`,
  homework: `${BASE}/homework`,
  workbook: `${BASE}/workbook`,
  alltest: `${BASE}/alltest`,
  pretest: `${BASE}/pretest`,
}

interface AppHeaderProps {
  solved: Record<string, boolean>
  problems: ProblemSet
}

export default function AppHeader({ solved, problems }: AppHeaderProps) {
  const pathname = usePathname()
  const total = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const done = Object.keys(solved).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const starThresholds = [20, 60, 90]

  function isActive(key: string) {
    if (key === 'home') return pathname === BASE
    return pathname.startsWith(PATH_MAP[key])
  }

  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-border-light bg-white px-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4">
        <Link href={BASE} className="whitespace-nowrap text-[17px] font-bold text-text-primary no-underline">
          🐦 <span className="text-yellow-dark">归一</span>问题探险
        </Link>

        <div className="h-1.5 min-w-[60px] max-w-[240px] flex-1 overflow-hidden rounded-sm bg-gray-100">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-yellow to-app-orange transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="hidden gap-0 overflow-x-auto scrollbar-none lg:flex xl:hidden">
          {NAV_PAGES.map(p => {
            const active = isActive(p.key)
            return (
              <Link
                key={p.key}
                href={PATH_MAP[p.key] || BASE}
                className={`flex h-14 items-center whitespace-nowrap px-3.5 text-[13px] font-medium no-underline transition-all ${
                  active ? 'text-yellow-dark' : 'text-text-muted hover:text-text-secondary'
                }`}
                style={{ borderBottomStyle: 'solid', borderBottomWidth: 2, borderBottomColor: active ? '#f59e0b' : 'transparent' }}
              >
                {p.icon} {p.label}
              </Link>
            )
          })}
        </div>

        <div className="ml-auto flex gap-1">
          {starThresholds.map((threshold, i) => (
            <span key={i} className="text-lg transition-all duration-300">
              {pct >= threshold ? '⭐' : '☆'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
