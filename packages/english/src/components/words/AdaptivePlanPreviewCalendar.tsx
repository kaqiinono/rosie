'use client'

import { useMemo, useState } from 'react'
import type { SimDaySnapshot } from '../../utils/adaptivePlanSimulate'

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

const MODE_LABELS = {
  normal: '普通',
  review_only: '仅复习',
  boss: 'Boss',
} as const

type Props = {
  days: SimDaySnapshot[]
  today: string
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function parseIso(iso: string): { year: number; monthIndex: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y ?? 0, monthIndex: (m ?? 1) - 1, day: d ?? 1 }
}

function monthTitle(year: number, monthIndex: number): string {
  return `${year}年${monthIndex + 1}月`
}

function dayWordCount(day: SimDaySnapshot): number {
  if (day.touches.length > 0) {
    return new Set(day.touches.map((t) => t.wordKey)).size
  }
  return new Set([...day.newWordKeys, ...day.reviewWordKeys, ...day.bossWordKeys]).size
}

function hasPractice(day: SimDaySnapshot): boolean {
  return dayWordCount(day) > 0 || day.totalQuestions > 0
}

function buildMonthGrid(year: number, monthIndex: number): Array<{ iso: string; day: number } | null> {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const startPad = (firstWeekday + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells: Array<{ iso: string; day: number } | null> = []
  for (let i = 0; i < startPad; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ iso: toIsoDate(year, monthIndex, d), day: d })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function AdaptivePlanPreviewCalendar({
  days,
  today,
  selectedDate,
  onSelectDate,
}: Props) {
  const dayByDate = useMemo(() => {
    const map = new Map<string, SimDaySnapshot>()
    for (const day of days) map.set(day.date, day)
    return map
  }, [days])

  const dateRange = useMemo(() => {
    if (days.length === 0) return { min: today, max: today }
    return { min: days[0]!.date, max: days.at(-1)!.date }
  }, [days, today])

  const initialMonth = useMemo(() => parseIso(today), [today])
  const [viewYear, setViewYear] = useState(initialMonth.year)
  const [viewMonthIndex, setViewMonthIndex] = useState(initialMonth.monthIndex)

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex],
  )

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonthIndex + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonthIndex(next.getMonth())
  }

  const monthHasData = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonthIndex + 1)}`
    return days.some((day) => day.date.startsWith(prefix))
  }, [days, viewYear, viewMonthIndex])

  return (
    <div className="rounded-[16px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--wm-border)] text-sm font-bold text-[var(--wm-text-dim)] transition-colors hover:border-[#93c5fd] hover:text-[#93c5fd]"
          aria-label="上一月"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-fredoka text-lg text-[#c4b5fd]">
            {monthTitle(viewYear, viewMonthIndex)}
          </div>
          {!monthHasData && (
            <div className="mt-0.5 text-[.68rem] font-bold text-[var(--wm-text-dim)]">
              本月无排程
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--wm-border)] text-sm font-bold text-[var(--wm-text-dim)] transition-colors hover:border-[#93c5fd] hover:text-[#93c5fd]"
          aria-label="下一月"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[.65rem] font-extrabold text-[var(--wm-text-dim)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, index) => {
          if (!cell) {
            return <div key={`pad-${index}`} className="min-h-[4.5rem]" />
          }

          const simDay = dayByDate.get(cell.iso)
          const inRange = cell.iso >= dateRange.min && cell.iso <= dateRange.max
          const isToday = cell.iso === today
          const isSelected = selectedDate === cell.iso
          const practiced = simDay != null && hasPractice(simDay)
          const wordCount = simDay ? dayWordCount(simDay) : 0
          const questionCount = simDay?.totalQuestions ?? 0

          const modeClass =
            simDay?.mode === 'boss'
              ? 'border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.1)]'
              : simDay?.mode === 'review_only'
                ? 'border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.08)]'
                : practiced
                  ? 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)]'
                  : simDay && inRange
                    ? 'border-[var(--wm-border)] bg-white/[.03]'
                    : 'border-transparent bg-transparent'

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!simDay}
              onClick={() => onSelectDate(isSelected ? null : cell.iso)}
              className={`flex min-h-[4.5rem] cursor-pointer flex-col rounded-xl border px-1 py-1.5 text-left transition-all disabled:cursor-default disabled:opacity-40 ${modeClass} ${
                isSelected ? 'ring-2 ring-[#c4b5fd] ring-offset-1 ring-offset-[var(--wm-surface2)]' : ''
              } ${isToday ? 'shadow-[inset_0_0_0_1px_rgba(147,197,253,.5)]' : ''}`}
            >
              <span
                className={`text-[.72rem] font-extrabold ${
                  isToday ? 'text-[#93c5fd]' : 'text-[var(--wm-text)]'
                }`}
              >
                {cell.day}
              </span>

              {simDay && practiced && (
                <span className="mt-auto text-[.58rem] font-extrabold leading-tight text-[#86efac]">
                  {wordCount} 词
                </span>
              )}
              {simDay && practiced && (
                <span className="text-[.58rem] font-bold leading-tight text-[#c4b5fd]">
                  {questionCount} 题
                </span>
              )}
              {simDay && !practiced && inRange && (
                <span className="mt-auto text-[.58rem] font-bold text-[var(--wm-text-dim)]">
                  休息
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[.65rem] font-bold text-[var(--wm-text-dim)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)]" />
          有练习
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.1)]" />
          Boss 日
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.08)]" />
          复习熔断
        </span>
        <span>点击日期查看详情</span>
      </div>

      {selectedDate && dayByDate.has(selectedDate) && (
        <div className="mt-4 rounded-xl border border-[rgba(139,92,246,.3)] bg-[rgba(139,92,246,.06)] px-3 py-2.5">
          {(() => {
            const day = dayByDate.get(selectedDate)!
            const words = dayWordCount(day)
            return (
              <div className="text-[.75rem] font-bold text-[#c4b5fd]">
                <span className="font-extrabold text-[var(--wm-text)]">{selectedDate}</span>
                <span className="mx-2 text-white/25">·</span>
                D{day.dayIndex}
                <span className="mx-2 text-white/25">·</span>
                {MODE_LABELS[day.mode]}
                <span className="mx-2 text-white/25">·</span>
                <span className="text-[#86efac]">{words} 词</span>
                <span className="mx-1 text-white/25">/</span>
                <span className="text-[#93c5fd]">{day.totalQuestions} 题</span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
