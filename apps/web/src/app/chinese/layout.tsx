'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CHINESE_BOOKS,
  ChineseProvider,
  chineseRoute,
  setActiveChineseBook,
  type ChineseBookSlug,
  useChineseContext,
} from '@rosie/chinese'
import { useImmersive } from '@rosie/core'
import { BrandLogo, SelectControl } from '@rosie/ui'

const BOOK_SHORT_LABEL: Record<ChineseBookSlug, string> = {
  g1b: '一下',
  g2a: '二上',
  g2b: '二下',
}

function ChineseNavInner() {
  const pathname = usePathname()
  const router = useRouter()
  const { bookSlug } = useChineseContext()
  const openBooks = CHINESE_BOOKS.filter((book) => book.isOpen)
  const tabs = [
    {
      href: chineseRoute(bookSlug),
      label: '首页',
      match: (p: string) =>
        p === chineseRoute(bookSlug) || p.startsWith(chineseRoute(bookSlug, 'units')),
    },
    {
      href: chineseRoute(bookSlug, 'daily'),
      label: '今日',
      match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'daily')),
    },
    {
      href: chineseRoute(bookSlug, 'chars'),
      label: '字',
      match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'chars')),
    },
    {
      href: chineseRoute(bookSlug, 'reading'),
      label: '阅读',
      match: (p: string) =>
        p.startsWith(chineseRoute(bookSlug, 'reading')) ||
        p.startsWith(chineseRoute(bookSlug, 'recordings')),
    },
    {
      href: chineseRoute(bookSlug, 'poems'),
      label: '古诗',
      match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'poems')),
    },
    {
      href: chineseRoute(bookSlug, 'accumulation'),
      label: '积累',
      match: (p: string) => p.startsWith(chineseRoute(bookSlug, 'accumulation')),
    },
  ]

  const switchBook = (nextBookSlug: ChineseBookSlug) => {
    const currentBookRoot = chineseRoute(bookSlug)
    const section = pathname.startsWith(currentBookRoot)
      ? pathname.slice(currentBookRoot.length).split('/').filter(Boolean)[0]
      : undefined
    const portableSections = new Set([
      'daily',
      'chars',
      'reading',
      'poems',
      'accumulation',
      'recordings',
    ])
    const nextPath =
      section && portableSections.has(section)
        ? chineseRoute(nextBookSlug, section)
        : chineseRoute(nextBookSlug)
    setActiveChineseBook(nextBookSlug)
    router.push(nextPath)
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-amber-100/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8">
        <BrandLogo size="lg" priority />

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const active = tab.match(pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 py-1 text-[11px] font-bold no-underline transition sm:rounded-full sm:px-3 sm:py-2 sm:text-xs ${
                  active
                    ? 'bg-amber-50 text-amber-700 after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:bg-amber-500 sm:bg-amber-500 sm:text-white sm:shadow-sm sm:after:hidden'
                    : 'text-amber-900/65 hover:bg-amber-50 hover:text-amber-800'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        <div className="w-[4.75rem] shrink-0 sm:hidden">
          <SelectControl
            value={bookSlug}
            options={openBooks.map((book) => ({
              value: book.slug,
              label: BOOK_SHORT_LABEL[book.slug],
            }))}
            onValueChange={(value) => switchBook(value as ChineseBookSlug)}
            ariaLabel="切换语文教材"
            className="w-full"
            selectClassName="px-2 pr-7"
          />
        </div>

        <div className="hidden shrink-0 sm:block">
          <SelectControl
            value={bookSlug}
            options={openBooks.map((book) => ({ value: book.slug, label: book.label }))}
            onValueChange={(value) => switchBook(value as ChineseBookSlug)}
            ariaLabel="切换语文教材"
            label="教材"
            selectClassName="min-w-32"
          />
        </div>
      </div>
    </nav>
  )
}

function ChineseNav() {
  return <ChineseNavInner />
}

function isChineseHomePath(pathname: string): boolean {
  return pathname === '/chinese'
}

export default function ChineseLayout({ children }: { children: React.ReactNode }) {
  const { isImmersive } = useImmersive()
  const pathname = usePathname()
  const hideNav =
    isImmersive ||
    pathname.includes('/chars/practice') ||
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
