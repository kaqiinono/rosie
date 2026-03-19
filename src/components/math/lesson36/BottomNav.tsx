'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_PAGES } from '@/utils/constant'
import { useLesson36 } from './Lesson36Provider'

const BASE = '/math/ny/36'
const PATH_MAP: Record<string, string> = {
  home: BASE,
  lesson: `${BASE}/lesson`,
  homework: `${BASE}/homework`,
  workbook: `${BASE}/workbook`,
  alltest: `${BASE}/alltest`,
  pretest: `${BASE}/pretest`,
  mistakes: `${BASE}/mistakes`,
}

const BOTTOM_KEYS = new Set(['home', 'lesson', 'homework', 'alltest', 'mistakes'])

export default function BottomNav() {
  const pathname = usePathname()
  const { wrongIds } = useLesson36()
  const visiblePages = NAV_PAGES.filter(p => BOTTOM_KEYS.has(p.key))

  function isActive(key: string) {
    if (key === 'home') return pathname === BASE
    return pathname.startsWith(`${BASE}/${key}`)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border-light bg-white pb-[max(0px,env(safe-area-inset-bottom))] md:hidden">
      {visiblePages.map(p => {
        const active = isActive(p.key)
        return (
          <Link
            key={p.key}
            href={PATH_MAP[p.key] || BASE}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] font-medium no-underline transition-colors ${
              active ? 'text-app-blue-dark' : 'text-text-muted'
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
