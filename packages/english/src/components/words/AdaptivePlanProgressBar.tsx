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
  const studied = learning + mastered
  const waiting = pending + notStarted
  const studiedPct = total > 0 ? Math.round((studied / total) * 100) : 0
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0

  const segments = [
    { key: 'MASTERED', count: mastered, className: 'bg-gradient-to-r from-[#22c55e] to-[#86efac]' },
    { key: 'LEARNING', count: learning, className: 'bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]' },
    {
      key: 'LEARNING_PENDING',
      count: pending,
      className: 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]',
    },
    { key: 'NOT_STARTED', count: notStarted, className: 'bg-white/12' },
  ] as const

  return (
    <div className="rounded-[18px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[.68rem] font-extrabold tracking-[.16em] text-[var(--wm-text-dim)] uppercase">
            Adaptive Plan Progress
          </div>
          <div className="font-fredoka mt-0.5 flex items-baseline gap-1.5 text-[var(--wm-text)]">
            <span className="text-2xl text-[#c4b5fd]">{studied}</span>
            <span className="text-sm text-[var(--wm-text-dim)]">/ {total} 已学习</span>
          </div>
          <div className="mt-0.5 text-[.7rem] font-bold text-[var(--wm-text-dim)]">
            每个开始学习的单词，都算一次进步
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-[rgba(167,139,250,.3)] bg-[rgba(167,139,250,.1)] px-2.5 py-1 text-[.7rem] font-extrabold text-[#c4b5fd]">
            覆盖 {studiedPct}%
          </div>
          <div className="rounded-full border border-[rgba(74,222,128,.3)] bg-[rgba(74,222,128,.08)] px-2.5 py-1 text-[.7rem] font-extrabold text-[#86efac]">
            掌握 {masteredPct}%
          </div>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between text-[.65rem] font-bold text-[var(--wm-text-dim)]">
        <span>整体学习覆盖</span>
        <span className="tabular-nums">
          {studied} / {total}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#60a5fa] via-[#8b5cf6] to-[#c084fc] transition-[width] duration-500"
          style={{ width: `${studiedPct}%` }}
        />
      </div>

      <div className="mt-3 mb-1 flex items-center justify-between text-[.65rem] font-bold text-[var(--wm-text-dim)]">
        <span>最终掌握进度</span>
        <span className="tabular-nums">
          {mastered} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#86efac] transition-[width] duration-500"
          style={{ width: `${masteredPct}%` }}
        />
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/[.06]">
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
        <div className="rounded-xl border border-[rgba(167,139,250,.18)] bg-[rgba(167,139,250,.06)] px-3 py-2">
          <div className="text-[#c4b5fd]/70">已学习</div>
          <div className="text-[.95rem] text-[#e9d5ff]">
            {studied} / {total}
          </div>
        </div>
        <div className="rounded-xl border border-[rgba(96,165,250,.18)] bg-[rgba(96,165,250,.06)] px-3 py-2">
          <div className="text-[#93c5fd]/70">学习中</div>
          <div className="text-[.95rem] text-[#bfdbfe]">{learning}</div>
        </div>
        <div className="rounded-xl border border-[rgba(74,222,128,.18)] bg-[rgba(74,222,128,.06)] px-3 py-2">
          <div className="text-[#86efac]/70">已掌握</div>
          <div className="text-[.95rem] text-[#bbf7d0]">{mastered}</div>
        </div>
        <div className="rounded-xl border border-white/[.07] bg-white/[.035] px-3 py-2">
          <div className="text-white/35">待开启</div>
          <div className="text-[.95rem] text-[var(--wm-text)]">{waiting}</div>
        </div>
      </div>
    </div>
  )
}
