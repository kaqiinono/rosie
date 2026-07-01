'use client'

import Link from 'next/link'
import type { HomeStats } from '@/hooks/useHomeStats'

type StatItem = {
  href: string
  icon: string
  label: string
  value: string
  hint: string
  accent: string
  accentBg: string
}

function buildItems(stats: HomeStats): StatItem[] {
  return [
    {
      href: '/math',
      icon: '🔢',
      label: '数学',
      value: `${stats.mathPracticed}/${stats.mathTotal}`,
      hint: '已练 / 总题',
      accent: 'text-indigo-700',
      accentBg: 'from-blue-50 to-indigo-50 border-indigo-100',
    },
    {
      href: '/english',
      icon: '📖',
      label: '英语',
      value: String(stats.englishPracticed),
      hint: stats.englishTotal > 0 ? `已练 · 词库 ${stats.englishTotal}` : '已练单词',
      accent: 'text-emerald-700',
      accentBg: 'from-emerald-50 to-cyan-50 border-emerald-100',
    },
    {
      href: '/calc',
      icon: '🧮',
      label: '口算',
      value: String(stats.calcTotal),
      hint: stats.calcPracticeDays > 0 ? `累计题 · ${stats.calcPracticeDays} 天` : '累计题',
      accent: 'text-violet-700',
      accentBg: 'from-violet-50 to-fuchsia-50 border-violet-100',
    },
    {
      href: '/mistakes',
      icon: '📕',
      label: '错题',
      value: String(stats.mistakesUnresolved),
      hint: stats.mistakesUnresolved > 0 ? '待改正' : '暂无待改',
      accent: 'text-amber-700',
      accentBg: 'from-amber-50 to-orange-50 border-amber-100',
    },
  ]
}

type HomeStatsPanelProps = {
  stats: HomeStats
  isLoading: boolean
}

export default function HomeStatsPanel({ stats, isLoading }: HomeStatsPanelProps) {
  const items = buildItems(stats)

  return (
    <section className="w-full max-w-[760px]">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-text-primary text-[13px] font-extrabold tracking-wide">
          📊 学习概览
        </h2>
        {isLoading && (
          <span className="text-text-muted text-[11px] font-semibold">同步中…</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-2xl border bg-gradient-to-br p-3.5 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md ${item.accentBg}`}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
              <span className={`text-[11px] font-extrabold tracking-wide ${item.accent}`}>
                {item.label}
              </span>
            </div>
            <div className={`font-fredoka text-[clamp(22px,4vw,28px)] leading-none font-black tabular-nums ${item.accent}`}>
              {isLoading ? '—' : item.value}
            </div>
            <div className="text-text-muted mt-1.5 text-[10px] font-semibold leading-snug">
              {isLoading ? '加载中' : item.hint}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
