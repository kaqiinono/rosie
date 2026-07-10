'use client'

import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'

type AdaptivePlanProgressBarProps = {
  rows: AdaptivePlanWordProgress[]
}

const STATUS_LABELS = {
  MASTERED: '已掌握',
  LEARNING: '学习中',
  LEARNING_PENDING: '待激活',
  NOT_STARTED: '未开始',
} as const

export default function AdaptivePlanProgressBar({ rows }: AdaptivePlanProgressBarProps) {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const total = activeRows.length
  const mastered = activeRows.filter((row) => row.status === 'MASTERED').length
  const learning = activeRows.filter((row) => row.status === 'LEARNING').length
  const pending = activeRows.filter((row) => row.status === 'LEARNING_PENDING').length
  const notStarted = activeRows.filter((row) => row.status === 'NOT_STARTED').length
  const queue = total - mastered
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0

  const segments = [
    { key: 'MASTERED', count: mastered, className: 'bg-gradient-to-r from-[#22c55e] to-[#86efac]' },
    { key: 'LEARNING', count: learning, className: 'bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]' },
    { key: 'LEARNING_PENDING', count: pending, className: 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]' },
    { key: 'NOT_STARTED', count: notStarted, className: 'bg-white/12' },
  ] as const

  return (
    <div className="rounded-[18px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[.68rem] font-extrabold tracking-[.16em] text-[var(--wm-text-dim)] uppercase">
            Adaptive Plan Progress
          </div>
          <div className="font-fredoka text-xl text-[var(--wm-text)]">{pct}% mastered</div>
        </div>
        <div className="text-right text-[.78rem] font-bold text-[var(--wm-text-dim)]">
          <span className="text-[#86efac]">{mastered}</span> MASTERED
          <span className="mx-2 text-white/20">/</span>
          <span className="text-[#fbbf24]">{queue}</span> queue
        </div>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-white/[.06]">
        {segments.map((segment) => {
          if (segment.count <= 0 || total <= 0) return null
          return (
            <div
              key={segment.key}
              className={segment.className}
              style={{ width: `${(segment.count / total) * 100}%` }}
              title={`${STATUS_LABELS[segment.key]} ${segment.count}`}
            />
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[.72rem] font-bold text-[var(--wm-text-dim)] sm:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.key} className="rounded-xl border border-white/[.07] bg-white/[.035] px-3 py-2">
            <div className="text-white/35">{STATUS_LABELS[segment.key]}</div>
            <div className="text-[.95rem] text-[var(--wm-text)]">{segment.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
