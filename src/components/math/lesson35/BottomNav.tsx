'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

export default function BottomNav() {
  const pathname = usePathname()
  const visiblePages = NAV_PAGES.filter(p => p.key !== 'pretest')

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
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] font-medium no-underline transition-colors ${
              active ? 'text-yellow-dark' : 'text-text-muted'
            }`}
          >
            <span className="text-lg leading-none">{p.icon}</span>
            {p.label}
          </Link>
        )
      })}
    </div>
  )
}
