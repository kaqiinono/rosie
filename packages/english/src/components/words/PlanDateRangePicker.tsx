'use client'

import { useMemo, useState } from 'react'
import { todayStr } from '@rosie/core'
import { addPlanDays } from './english-weekly-plan-shared'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type Props = {
  startDate: string
  endDate: string
  occupiedDates: Set<string>
  onRangeChange: (start: string, end: string) => void
}

function toMonthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y!, month: m! - 1 }
}

function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key)
  return `${year}年${month + 1}月`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function rangeContainsOccupied(start: string, end: string, occupied: Set<string>): boolean {
  const lo = start <= end ? start : end
  const hi = start <= end ? end : start
  let cur = lo
  while (cur <= hi) {
    if (occupied.has(cur)) return true
    cur = addPlanDays(cur, 1)
  }
  return false
}

export default function PlanDateRangePicker({ startDate, endDate, occupiedDates, onRangeChange }: Props) {
  const today = todayStr()
  const initialMonth = startDate.slice(0, 7) || today.slice(0, 7)
  const [viewMonthKey, setViewMonthKey] = useState(initialMonth)
  const [pendingStart, setPendingStart] = useState<string | null>(null)

  const { year, month } = parseMonthKey(viewMonthKey)
  const firstWeekday = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)

  const cells = useMemo(() => {
    const list: { date: string | null; day: number | null }[] = []
    for (let i = 0; i < firstWeekday; i++) list.push({ date: null, day: null })
    for (let d = 1; d <= totalDays; d++) {
      list.push({ date: dateStr(year, month, d), day: d })
    }
    return list
  }, [year, month, firstWeekday, totalDays])

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setViewMonthKey(toMonthKey(d.getFullYear(), d.getMonth()))
  }

  const handleDayClick = (date: string) => {
    if (occupiedDates.has(date)) return

    if (!pendingStart) {
      setPendingStart(date)
      onRangeChange(date, date)
      return
    }

    const lo = pendingStart <= date ? pendingStart : date
    const hi = pendingStart <= date ? date : pendingStart
    if (rangeContainsOccupied(lo, hi, occupiedDates)) return

    onRangeChange(lo, hi)
    setPendingStart(null)
  }

  const lo = startDate && endDate ? (startDate <= endDate ? startDate : endDate) : startDate
  const hi = startDate && endDate ? (startDate <= endDate ? endDate : startDate) : endDate

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="cursor-pointer rounded-lg px-2 py-1 text-[14px] font-bold text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]"
        >
          ‹
        </button>
        <span className="text-[13px] font-extrabold text-[var(--wm-text)]">{monthLabel(viewMonthKey)}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="cursor-pointer rounded-lg px-2 py-1 text-[14px] font-bold text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="py-1 text-center text-[10px] font-bold text-[var(--wm-text-dim)]">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={`empty-${idx}`} className="aspect-square" />
          }

          const isOccupied = occupiedDates.has(cell.date)
          const isToday = cell.date === today
          const inRange = lo && hi && cell.date >= lo && cell.date <= hi
          const isEdge = cell.date === lo || cell.date === hi
          const isPending = cell.date === pendingStart

          return (
            <button
              key={cell.date}
              type="button"
              disabled={isOccupied}
              onClick={() => handleDayClick(cell.date!)}
              className="relative flex aspect-square cursor-pointer items-center justify-center rounded-lg text-[12px] font-bold transition-all disabled:cursor-not-allowed"
              style={{
                background: isOccupied
                  ? 'rgba(255,255,255,.04)'
                  : inRange
                    ? isEdge
                      ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                      : 'rgba(245,158,11,.15)'
                    : isPending
                      ? 'rgba(245,158,11,.25)'
                      : 'var(--wm-surface2)',
                color: isOccupied
                  ? 'var(--wm-text-dim)'
                  : inRange && isEdge
                    ? 'white'
                    : inRange
                      ? '#fbbf24'
                      : 'var(--wm-text)',
                border: isToday
                  ? '2px solid rgba(245,158,11,.5)'
                  : isOccupied
                    ? '1px dashed var(--wm-border)'
                    : '1px solid var(--wm-border)',
                textDecoration: isOccupied ? 'line-through' : 'none',
                opacity: isOccupied ? 0.5 : 1,
              }}
              title={isOccupied ? '已有计划' : undefined}
            >
              {cell.day}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--wm-text-dim)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-[#f59e0b]/50 bg-[rgba(245,158,11,.2)]" />
          已选时间段
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-dashed border-[var(--wm-border)] bg-[var(--wm-surface2)]"
            style={{ textDecoration: 'line-through' }}
          />
          已有计划（不可选）
        </span>
        <span className="opacity-70">点击两次选择起止日期</span>
      </div>
    </div>
  )
}
