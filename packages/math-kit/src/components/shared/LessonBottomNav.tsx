'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_PAGES } from '@rosie/core'
import type { LessonContextType } from './createLessonProvider'

const BOTTOM_KEYS = new Set(['home', 'lesson', 'homework', 'alltest', 'mistakes'])

type BottomNavItem = {
  key: string
  icon: string
  label: string
}

type LessonThemeConfig = {
  basePath: string
  activeColor: string
}

type Props = {
  config: LessonThemeConfig
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
    notes: `${base}/notes`,
    drafts: `${base}/drafts`,
  }
}

export default function LessonBottomNav({ config, useLessonContext }: Props) {
  const pathname = usePathname()
  const { wrongIds } = useLessonContext()
  const pathMap = buildPathMap(config.basePath)
  const lessonPages = NAV_PAGES.filter(p => BOTTOM_KEYS.has(p.key))
  const visiblePages: BottomNavItem[] = [
    ...lessonPages,
    { key: 'notes', icon: '📝', label: '笔记' },
    { key: 'drafts', icon: '🗒️', label: '草稿' },
  ]

  function isActive(key: string): boolean {
    if (key === 'home') return pathname === config.basePath
    return pathname.startsWith(`${config.basePath}/${key}`)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border-light bg-white pb-[max(0px,env(safe-area-inset-bottom))] md:hidden">
      {visiblePages.map(p => {
        const active = isActive(p.key)
        return (
          <Link
            key={p.key}
            href={pathMap[p.key] || config.basePath}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] font-medium no-underline transition-colors ${
              active ? config.activeColor : 'text-text-muted'
            }`}
          >
            <span className="relative text-lg leading-none">
              {p.icon}
              {p.key === 'mistakes' && wrongIds.size > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-0.5 text-[9px] font-bold leading-none text-white">
                  {wrongIds.size > 9 ? '9+' : wrongIds.size}
                </span>
              )}
            </span>
            {p.label}
          </Link>
        )
      })}
    </div>
  )
}
