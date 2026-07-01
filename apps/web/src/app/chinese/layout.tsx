'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChineseProvider } from '@rosie/chinese'
import { useImmersive } from '@rosie/core'

function ChineseNav() {
  const pathname = usePathname()
  const tabs = [
    { href: '/chinese', label: '首页', match: (p: string) => p === '/chinese' },
    { href: '/chinese/daily', label: '今日', match: (p: string) => p.startsWith('/chinese/daily') },
    { href: '/chinese/chars', label: '字', match: (p: string) => p.startsWith('/chinese/chars') },
    { href: '/chinese/phrases', label: '词', match: (p: string) => p.startsWith('/chinese/phrases') },
    { href: '/chinese/poems', label: '古诗', match: (p: string) => p.startsWith('/chinese/poems') },
  ]
  return (
    <nav className="sticky top-0 z-20 border-b border-amber-100/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-3 py-2">
        {tabs.map((tab) => {
          const active = tab.match(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold no-underline transition ${
                active
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-900/70 hover:bg-amber-50'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
        <Link
          href="/"
          className="ml-auto shrink-0 text-xs font-semibold text-slate-400 no-underline hover:text-slate-600"
        >
          ← 乐园
        </Link>
      </div>
    </nav>
  )
}

export default function ChineseLayout({ children }: { children: React.ReactNode }) {
  const { isImmersive } = useImmersive()
  const pathname = usePathname()
  const hideNav = isImmersive || pathname.startsWith('/chinese/chars/practice')

  return (
    <ChineseProvider>
      <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/40 font-nunito">
        {!hideNav && <ChineseNav />}
        {children}
      </div>
    </ChineseProvider>
  )
}
