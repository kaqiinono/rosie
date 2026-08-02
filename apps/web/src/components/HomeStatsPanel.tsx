'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useHomeStats, type HomeStats } from '@/hooks/useHomeStats'

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
      href: '/calc',
      icon: '🧮',
      label: '口算',
      value: String(stats.calcTotal),
      hint: stats.calcPracticeDays > 0 ? `累计题 · ${stats.calcPracticeDays} 天` : '累计题',
      accent: 'text-violet-700',
      accentBg: 'from-violet-50 to-fuchsia-50 border-violet-100',
    },
    {
      href: '/english',
      icon: '📖',
      label: '英语',
      value: String(stats.englishPracticed),
      hint: '已练单词',
      accent: 'text-emerald-700',
      accentBg: 'from-emerald-50 to-cyan-50 border-emerald-100',
    },
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
      href: '/chinese',
      icon: '📜',
      label: '语文',
      value:
        stats.chineseRecognizeTotal > 0
          ? `${stats.chineseRecognized}/${stats.chineseRecognizeTotal}`
          : String(stats.chineseRecognized),
      hint: stats.chineseRecognizeTotal > 0 ? '已认 / 会认' : '已认字',
      accent: 'text-orange-700',
      accentBg: 'from-orange-50 to-rose-50 border-orange-100',
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

export default function HomeStatsPanel() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  // Fetch only after the user expands — collapsed home skips overview requests.
  const { stats, isLoading } = useHomeStats(expanded ? user : null)
  const items = buildItems(stats)

  if (!user) return null

  return (
    <section className="w-full max-w-[1040px]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none" aria-hidden>
            📊
          </span>
          <span className="text-text-primary text-[13px] font-extrabold tracking-wide">
            学习概览
          </span>
          {!expanded && (
            <span className="text-text-muted truncate text-[11px] font-semibold">
              点击展开查看各科进度
            </span>
          )}
          {expanded && isLoading && (
            <span className="text-text-muted text-[11px] font-semibold">同步中…</span>
          )}
        </span>
        <span
          className={`text-text-muted shrink-0 text-xs font-bold transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group rounded-2xl border bg-gradient-to-br p-3.5 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md ${item.accentBg}`}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className={`text-[11px] font-extrabold tracking-wide ${item.accent}`}>
                  {item.label}
                </span>
              </div>
              <div
                className={`font-fredoka text-[clamp(22px,4vw,28px)] leading-none font-black tabular-nums ${item.accent}`}
              >
                {isLoading ? '—' : item.value}
              </div>
              <div className="text-text-muted mt-1.5 text-[10px] font-semibold leading-snug">
                {isLoading ? '加载中' : item.hint}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
