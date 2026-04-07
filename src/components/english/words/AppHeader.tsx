'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface AppHeaderProps {
  onImport: () => void
  onExport: () => void
  onImmersive: () => void
}

const BASE = '/english/words'

const TABS = [
  { id: 'cards', path: `${BASE}/cards`, icon: '🃏', label: '背单词' },
  { id: 'practice', path: `${BASE}/practice`, icon: '✏️', label: '单词练习' },
  { id: 'daily', path: `${BASE}/daily`, icon: '📅', label: '每日一练' },
]

export default function AppHeader({ onImport, onExport, onImmersive }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--wm-border)] bg-[var(--wm-bg)]/95 px-4 py-2.5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2.5">
        <Link href={'/'}>
          <div className="font-fredoka bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-2xl font-bold whitespace-nowrap text-transparent">
            📚 Rosie Fun
          </div>
        </Link>

        <nav className="flex gap-1 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.path)
            return (
              <button
                key={t.id}
                onClick={() => router.push(t.path)}
                className={`font-nunito cursor-pointer rounded-[9px] px-3.5 py-1.5 text-[1rem] font-bold transition-all ${
                  active
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_3px_10px_rgba(233,69,96,.35)]'
                    : 'bg-transparent text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                }`}
              >
                {t.icon} {t.label}
              </button>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div ref={ddRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-white/10 bg-white/[.06] px-3.5 py-1.5 text-[1rem] font-bold whitespace-nowrap text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              词库管理
              <svg
                className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+8px)] right-0 z-[200] min-w-[160px] animate-[drop-in_.18s_cubic-bezier(.4,0,.2,1)] overflow-hidden rounded-xl border border-white/10 bg-[#1e1e35] shadow-[0_8px_32px_rgba(0,0,0,.5)]">
                <button
                  onClick={() => {
                    onImport()
                    setMenuOpen(false)
                  }}
                  className="font-nunito flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2.5 text-left text-[1rem] font-bold text-white/75 transition-all hover:bg-white/[.07] hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="opacity-70"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  导入单词表
                </button>
                <button
                  onClick={() => {
                    onExport()
                    setMenuOpen(false)
                  }}
                  className="font-nunito flex w-full cursor-pointer items-center gap-2.5 border-0 border-t border-white/[.06] bg-transparent px-3.5 py-2.5 text-left text-[1rem] font-bold text-white/75 transition-all hover:bg-white/[.07] hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="opacity-70"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  下载词库 Excel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onImmersive}
            className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] px-3.5 py-1.5 text-[1rem] font-bold whitespace-nowrap text-white shadow-[0_2px_10px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(124,58,237,.5)]"
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
        </div>
      </div>
    </header>
  )
}
