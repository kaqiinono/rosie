import type { ReactNode } from 'react'
import Link from 'next/link'

export default function EnglishHubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-dim min-h-screen font-nunito">
      <header className="sticky top-0 z-10 bg-surface-dim border-b border-border-light">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center relative">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>←</span>
            <span>主页</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-base font-bold text-text-primary">
            英语天地
          </span>
        </div>
      </header>
      {children}
    </div>
  )
}
