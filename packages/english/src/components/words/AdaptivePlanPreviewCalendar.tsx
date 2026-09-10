'use client'

import { useMemo } from 'react'
import type { SimDaySnapshot } from '../../utils/adaptivePlanSimulate'

const MODE_LABELS = { normal: '主线', review_only: '兼容', boss: 'Boss 验收' } as const

type Props = {
  days: SimDaySnapshot[]
  /** Retained for call-site compatibility; V2 preview is not calendar-based. */
  today: string
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

function wordCount(batch: SimDaySnapshot): number {
  return new Set([...batch.newWordKeys, ...batch.reviewWordKeys, ...batch.bossWordKeys]).size
}

export default function AdaptivePlanPreviewCalendar({ days, today, selectedDate, onSelectDate }: Props) {
  void today
  const selected = useMemo(
    () => days.find((batch) => batch.date === selectedDate) ?? null,
    [days, selectedDate],
  )

  return (
    <div className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] p-4">
      <div className="mb-3 text-[.68rem] font-bold leading-relaxed text-[var(--wm-text-dim)]">
        每一格代表完成一个批次；批次可以跨天完成，同一天也可再加练一批。
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
        {days.map((batch) => {
          const active = selectedDate === batch.date
          const boss = batch.mode === 'boss'
          return (
            <button
              key={`${batch.dayIndex}-${batch.date}`}
              type="button"
              onClick={() => onSelectDate(active ? null : batch.date)}
              className={`min-h-[5rem] cursor-pointer rounded-xl border px-2 py-2 text-left transition ${
                boss
                  ? 'border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.1)]'
                  : 'border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.07)]'
              } ${active ? 'ring-2 ring-[#c4b5fd]' : ''}`}
            >
              <div className="text-[.72rem] font-extrabold text-[var(--wm-text)]">批次 {batch.dayIndex}</div>
              <div className={`mt-1 text-[.62rem] font-extrabold ${boss ? 'text-[#fbbf24]' : 'text-[#93c5fd]'}`}>
                {MODE_LABELS[batch.mode]}
              </div>
              <div className="mt-1 text-[.6rem] font-bold text-[var(--wm-text-dim)]">
                {wordCount(batch)} 词 · {batch.totalQuestions} 题
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-[rgba(139,92,246,.3)] bg-[rgba(139,92,246,.06)] px-3 py-2.5 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
          <span className="font-extrabold text-[#c4b5fd]">批次 {selected.dayIndex}</span>
          <span className="mx-2 text-white/25">·</span>{MODE_LABELS[selected.mode]}
          <span className="mx-2 text-white/25">·</span>新词 {selected.newWordKeys.length}
          <span className="mx-2 text-white/25">·</span>阶段推进 {selected.reviewWordKeys.length}
          {selected.bossWordKeys.length > 0 && (
            <><span className="mx-2 text-white/25">·</span>Boss {selected.bossWordKeys.length}</>
          )}
        </div>
      )}
    </div>
  )
}
