'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ProblemSet, Problem } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'
import type { LessonContextType } from './createLessonProvider'

type LessonHeaderConfig = {
  basePath: string
  emoji: string
  titleShort: string
  titleFull: string
  titleColor: string
  navActiveColor: string
  navActiveBorderColor: string
  /** Back button uses SVG arrow by default; set to text like '←' to override */
  backIcon?: React.ReactNode
}

type Props = {
  config: LessonHeaderConfig
  problems: ProblemSet
  useLessonContext: () => LessonContextType
}

function buildPathMap(base: string): Record<string, string> {
  return {
    home: base,
    lesson: `${base}/lesson`,
    homework: `${base}/homework`,
    workbook: `${base}/workbook`,
    alltest: `${base}/alltest`,
    pretest: `${base}/pretest`,
    mistakes: `${base}/mistakes`,
  }
}

const defaultBackIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export default function LessonAppHeader({ config, problems, useLessonContext }: Props) {
  const pathname = usePathname()
  const { solveCount } = useLessonContext()
  const pathMap = buildPathMap(config.basePath)

  const allIds = new Set((Object.values(problems) as Problem[][]).flatMap(l => l.map(p => p.id)))
  const total = allIds.size
  const mastered = [...allIds].filter(id => (solveCount[id] ?? 0) >= 3).length

  function isActive(key: string): boolean {
    if (key === 'home') return pathname === config.basePath
    return pathname.startsWith(pathMap[key])
  }

  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-border-light bg-white/95 backdrop-blur-sm shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-2 pl-3 pr-[168px] sm:h-14 sm:gap-3 sm:pl-5 sm:pr-5">

        <Link
          href="/math"
          className="flex shrink-0 items-center justify-center rounded-full border border-gray-200 text-text-muted no-underline transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-text-secondary
            h-8 w-8
            sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5"
        >
          {config.backIcon ?? defaultBackIcon}
          <span className="hidden sm:inline text-[12px] font-medium">课程列表</span>
        </Link>

        <Link href={config.basePath} className="shrink-0 no-underline">
          <span className="text-[15px] font-bold text-text-primary sm:text-[17px]">
            {config.emoji}{' '}
            <span className={config.titleColor}>{config.titleShort}</span>
            <span className="hidden min-[480px]:inline">{config.titleFull}</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-text-secondary sm:gap-1.5 sm:px-3 sm:text-[12px]">
          🦋{' '}
          <span className="text-app-green-dark">{mastered}</span>
          <span className="text-text-muted">/{total}</span>
        </div>

        <div className="hidden gap-0 overflow-x-auto scrollbar-none lg:flex xl:hidden">
          {NAV_PAGES.map(p => {
            const active = isActive(p.key)
            return (
              <Link
                key={p.key}
                href={pathMap[p.key] || config.basePath}
                className={`flex h-12 items-center whitespace-nowrap px-3 text-[13px] font-medium no-underline transition-all sm:h-14 ${
                  active ? config.navActiveColor : 'text-text-muted hover:text-text-secondary'
                }`}
                style={{ borderBottom: `2px solid ${active ? config.navActiveBorderColor : 'transparent'}` }}
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
