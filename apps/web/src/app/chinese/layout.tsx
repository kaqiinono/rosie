'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChineseProvider, chineseRoute, useChineseContext } from '@rosie/chinese'
import { useImmersive } from '@rosie/core'

function ChineseNavInner() {
  const pathname = usePathname()
  const { bookSlug } = useChineseContext()
  const tabs = [
    { href: chineseRoute(bookSlug), label: '首页', match: (p: string) => p === chineseRoute(bookSlug) },
    { href: chineseRoute(bookSlug, 'daily'), label: '今日', match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'daily')) },
    { href: chineseRoute(bookSlug, 'chars'), label: '字', match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'chars')) },
    { href: chineseRoute(bookSlug, 'reading'), label: '阅读', match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'reading')) },
    { href: chineseRoute(bookSlug, 'poems'), label: '古诗', match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'poems')) },
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
          href="/chinese"
          className="ml-auto shrink-0 text-xs font-semibold text-slate-400 no-underline hover:text-slate-600"
        >
          换册
        </Link>
        <Link
          href="/"
          className="shrink-0 text-xs font-semibold text-slate-400 no-underline hover:text-slate-600"
        >
          ← 乐园
        </Link>
      </div>
    </nav>
  )
}

function ChineseNav() {
  return <ChineseNavInner />
}

function isChineseHomePath(pathname: string): boolean {
  if (pathname === '/chinese') return true
  return /^\/chinese\/g\d[ab]$/.test(pathname)
}

export default function ChineseLayout({ children }: { children: React.ReactNode }) {
  const { isImmersive } = useImmersive()
  const pathname = usePathname()
  const hideNav =
    isImmersive ||
    pathname.startsWith('/chinese/chars/practice') ||
    pathname.includes('/chars/print') ||
    isChineseHomePath(pathname)

  return (
    <ChineseProvider>
      <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/40 font-nunito">
        {!hideNav && <ChineseNav />}
        {children}
      </div>
    </ChineseProvider>
  )
}
