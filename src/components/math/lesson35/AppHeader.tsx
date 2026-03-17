'use client'

import type { PageName, ProblemSet } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'

interface AppHeaderProps {
  currentPage: PageName
  solved: Record<string, boolean>
  problems: ProblemSet
  onNavigate: (page: PageName) => void
}

export default function AppHeader({ currentPage, solved, problems, onNavigate }: AppHeaderProps) {
  const total = Object.values(problems).reduce((s, l) => s + l.length, 0)
  const done = Object.keys(solved).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const starThresholds = [20, 60, 90]

  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-border-light bg-white px-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4">
        <div className="whitespace-nowrap text-[17px] font-bold text-text-primary">
          🐦 <span className="text-yellow-dark">归一</span>问题探险
        </div>

        <div className="h-1.5 min-w-[60px] max-w-[240px] flex-1 overflow-hidden rounded-sm bg-gray-100">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-yellow to-app-orange transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Desktop header tabs (1024px–1279px) */}
        <div className="hidden gap-0 overflow-x-auto scrollbar-none lg:flex xl:hidden">
          {NAV_PAGES.map(p => {
            const active = currentPage === p.key
            return (
              <button
                key={p.key}
                onClick={() => onNavigate(p.key as PageName)}
                className={`flex h-14 cursor-pointer items-center whitespace-nowrap border-b-2 border-none bg-transparent px-3.5 text-[13px] font-medium transition-all ${
                  active
                    ? 'border-b-yellow text-yellow-dark'
                    : 'border-b-transparent text-text-muted hover:text-text-secondary'
                }`}
                style={{ borderBottomStyle: 'solid', borderBottomWidth: 2, borderBottomColor: active ? '#f59e0b' : 'transparent' }}
              >
                {p.icon} {p.label}
              </button>
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
