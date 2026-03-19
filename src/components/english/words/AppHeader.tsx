'use client'

import { useState, useRef, useEffect } from 'react'

type TabId = 'cards' | 'practice' | 'daily'

interface AppHeaderProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onImport: () => void
  onExport: () => void
  onImmersive: () => void
}

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'cards', icon: '🃏', label: '背单词' },
  { id: 'practice', icon: '✏️', label: '单词练习' },
  { id: 'daily', icon: '📅', label: '每日一练' },
]

export default function AppHeader({ activeTab, onTabChange, onImport, onExport, onImmersive }: AppHeaderProps) {
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
    <header className="sticky top-0 z-50 bg-[var(--wm-bg)]/95 backdrop-blur-xl border-b border-[var(--wm-border)] px-4 py-2.5">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-2.5 flex-wrap">
        <div className="font-bold font-fredoka text-2xl bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-transparent whitespace-nowrap">
          📚 Rosie Fun
        </div>

        <nav className="flex gap-1 bg-[var(--wm-surface)] p-1 rounded-xl border border-[var(--wm-border)]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`px-3.5 py-1.5 rounded-[9px] font-nunito font-bold text-[.82rem] transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_3px_10px_rgba(233,69,96,.35)]'
                  : 'bg-transparent text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div ref={ddRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] font-nunito font-bold text-[.82rem] bg-white/[.06] border-[1.5px] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              词库管理
              <svg
                className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e1e35] border border-white/10 rounded-xl overflow-hidden min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,.5)] z-[200] animate-[drop-in_.18s_cubic-bezier(.4,0,.2,1)]">
                <button
                  onClick={() => { onImport(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent border-0 text-white/75 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:bg-white/[.07] hover:text-white text-left"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  导入单词表
                </button>
                <button
                  onClick={() => { onExport(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent border-0 text-white/75 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:bg-white/[.07] hover:text-white text-left border-t border-white/[.06]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70">
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] font-nunito font-bold text-[.82rem] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-white shadow-[0_2px_10px_rgba(124,58,237,.35)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(124,58,237,.5)] transition-all cursor-pointer whitespace-nowrap border-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            沉浸模式
          </button>
        </div>
      </div>
    </header>
  )
}
