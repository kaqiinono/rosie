'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_PAGES } from '@/utils/constant'
import type { LessonContextType } from './createLessonProvider'

const BOTTOM_KEYS = new Set(['home', 'lesson', 'homework', 'alltest', 'mistakes'])

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
  }
}

export default function LessonBottomNav({ config, useLessonContext }: Props) {
  const pathname = usePathname()
  const { wrongIds } = useLessonContext()
  const pathMap = buildPathMap(config.basePath)
  const visiblePages = NAV_PAGES.filter(p => BOTTOM_KEYS.has(p.key))

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
            <span className="text-lg leading-none">{p.icon}</span>
            {p.label}
            {p.key === 'mistakes' && wrongIds.size > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-bold text-white">
                {wrongIds.size > 9 ? '9+' : wrongIds.size}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
