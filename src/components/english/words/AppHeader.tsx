'use client'

import { useState, useRef, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BookOpen, Pencil, Calendar, Plus, ChevronDown, Upload, Download, Zap } from 'lucide-react'

type TabId = 'cards' | 'practice' | 'daily'

interface AppHeaderProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onImport: () => void
  onExport: () => void
  onImmersive: () => void
}

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'cards', icon: <BookOpen className="h-3.5 w-3.5" />, label: '背单词' },
  { id: 'practice', icon: <Pencil className="h-3.5 w-3.5" />, label: '单词练习' },
  { id: 'daily', icon: <Calendar className="h-3.5 w-3.5" />, label: '每日一练' },
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
        <div className="font-fredoka text-2xl bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-transparent whitespace-nowrap">
          📚 WordMaster Pro
        </div>

        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as TabId)}>
          <TabsList className="bg-[var(--wm-surface)] border border-[var(--wm-border)]">
            {TABS.map(t => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  'gap-1.5 font-nunito text-[.82rem]',
                  activeTab === t.id
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_3px_10px_rgba(233,69,96,.35)]'
                    : 'text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                )}
              >
                {t.icon} {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 shrink-0">
          <div ref={ddRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-white/[.06] border-[1.5px] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white font-nunito font-bold text-[.82rem] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              词库管理
              <ChevronDown className={cn('h-3 w-3 transition-transform', menuOpen && 'rotate-180')} />
            </Button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e1e35] border border-white/10 rounded-xl overflow-hidden min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,.5)] z-[200] animate-[drop-in_.18s_cubic-bezier(.4,0,.2,1)]">
                <button
                  onClick={() => { onImport(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent border-0 text-white/75 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:bg-white/[.07] hover:text-white text-left"
                >
                  <Upload className="h-3.5 w-3.5 opacity-70" />
                  导入单词表
                </button>
                <button
                  onClick={() => { onExport(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent border-0 text-white/75 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:bg-white/[.07] hover:text-white text-left border-t border-white/[.06]"
                >
                  <Download className="h-3.5 w-3.5 opacity-70" />
                  下载词库 Excel
                </button>
              </div>
            )}
          </div>
          <Button
            onClick={onImmersive}
            variant="glow"
            size="sm"
            className="bg-gradient-to-br from-[#7c3aed] to-[#a855f7] shadow-[0_2px_10px_rgba(124,58,237,.35)] hover:shadow-[0_4px_16px_rgba(124,58,237,.5)] font-nunito font-bold text-[.82rem] whitespace-nowrap"
          >
            <Zap className="h-3.5 w-3.5" />
            沉浸模式
          </Button>
        </div>
      </div>
    </header>
  )
}
