'use client'

import type { PageName } from '@/utils/type'
import { NAV_PAGES } from '@/utils/constant'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  currentPage: PageName
  onNavigate: (page: PageName) => void
}

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const visiblePages = NAV_PAGES.filter(p => p.key !== 'pretest')
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border-light bg-white pb-[max(0px,env(safe-area-inset-bottom))] md:hidden">
      {visiblePages.map(p => {
        const active = currentPage === p.key || (currentPage === 'detail' && p.key === 'home')
        return (
          <Button
            key={p.key}
            variant="ghost"
            onClick={() => onNavigate(p.key as PageName)}
            className={cn(
              'flex h-auto flex-1 flex-col items-center justify-center gap-0.5 rounded-none px-0.5 py-1.5 text-[9px] font-medium',
              active ? 'text-yellow-dark' : 'text-text-muted'
            )}
          >
            <span className="text-lg leading-none">{p.icon}</span>
            {p.label}
          </Button>
        )
      })}
    </div>
  )
}
