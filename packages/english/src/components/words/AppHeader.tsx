'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'

interface AppHeaderProps {
  onImmersive: () => void
}

const BASE = '/english/words'

const TABS = [
  { id: 'cards', path: `${BASE}/cards`, icon: '🃏', label: '单词' },
  { id: 'practice', path: `${BASE}/practice`, icon: '✏️', label: '练习' },
  { id: 'daily', path: `${BASE}/daily`, icon: '📅', label: '计划' },
  { id: 'reading', path: `${BASE}/reading`, icon: '📖', label: '阅读' },
]

export default function AppHeader({ onImmersive }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--wm-border)] bg-[var(--wm-bg)]/95 px-4 py-2.5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2.5">
        <Link href="/english">
          <div className="font-fredoka bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-2xl font-bold whitespace-nowrap text-transparent">
            📚 {username ?? 'Rosie'} Fun
          </div>
        </Link>

        <nav className="flex gap-1 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.path)
            return (
              <button
                key={t.id}
                onClick={() => router.push(t.path)}
                title={t.label}
                aria-label={t.label}
                className={`font-nunito flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[9px] px-2 py-1.5 text-[0.875rem] font-bold transition-all sm:px-2.5 ${
                  active
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_3px_10px_rgba(233,69,96,.35)]'
                    : 'bg-transparent text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                }`}
              >
                <span aria-hidden className="text-[1rem] leading-none">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </nav>

        {pathname.startsWith(`${BASE}/cards`) && (
          <button
            type="button"
            onClick={onImmersive}
            className="font-nunito flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] px-3.5 py-1.5 text-[0.875rem] font-bold whitespace-nowrap text-white shadow-[0_2px_10px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(124,58,237,.5)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            沉浸模式
          </button>
        )}
      </div>
    </header>
  )
}
