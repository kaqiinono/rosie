'use client'

import { useMemo, useState } from 'react'
import type { MathWeeklyPlan, ProblemSet } from '@rosie/core'
import {
  PlanPreviewCalendar,
  mondayWeekDates,
  dayLabel,
  fmtDate,
} from './math-weekly-plan-shared'

type MapMode = 'week' | 'month'

type Props = {
  plan: MathWeeklyPlan
  problemSets?: Record<string, ProblemSet>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  today: string
}

const WEEK_HEADER = ['一', '二', '三', '四', '五', '六', '日']

export default function MathPlanMap({
  plan,
  problemSets,
  selectedDate,
  onSelectDate,
  today,
}: Props) {
  const [mode, setMode] = useState<MapMode>('week')
  const weekDates = useMemo(() => mondayWeekDates(today), [today])
  const dayByDate = useMemo(() => {
    const map = new Map(plan.days.map((d) => [d.date, d]))
    return map
  }, [plan.days])

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-orange-400 uppercase">
          <span>🗺️</span> 计划地图
        </div>
        <div
          className="flex rounded-full p-0.5"
          style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.06)' }}
        >
          {([
            { key: 'week' as const, label: '周' },
            { key: 'month' as const, label: '月' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className="cursor-pointer rounded-full px-3 py-1 text-[11px] font-extrabold transition-all"
              style={
                mode === opt.key
                  ? {
                      background: 'rgba(249,115,22,.15)',
                      color: '#c2410c',
                      boxShadow: '0 1px 4px rgba(249,115,22,.2)',
                    }
                  : { color: '#9ca3af' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'week' ? (
        <div>
          <div className="mb-2 text-center text-[11px] font-bold text-gray-400">
            本周 · {fmtDate(weekDates[0]!)} – {fmtDate(weekDates[6]!)}
          </div>
          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {WEEK_HEADER.map((w) => (
              <div key={w} className="py-0.5 text-center text-[10px] font-bold text-gray-400">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((date) => {
              const day = dayByDate.get(date)
              const total = day?.problems.length ?? 0
              const hasPlan = Boolean(day)
              const prog = plan.progress[date] ?? { doneKeys: [] }
              const done = hasPlan
                ? prog.doneKeys.filter((k) => day!.problems.some((p) => p.key === k)).length
                : 0
              const isToday = date === today
              const isPast = date < today
              const isSelected = date === selectedDate
              const isComplete = hasPlan && total > 0 && done >= total

              let bg = 'rgba(255,255,255,.7)'
              let border = 'rgba(0,0,0,.08)'
              let textClr = '#9ca3af'
              let shadow = 'none'

              if (!hasPlan) {
                bg = 'rgba(0,0,0,.03)'
                border = 'rgba(0,0,0,.04)'
                textClr = '#d1d5db'
              } else if (isComplete) {
                bg = 'linear-gradient(135deg,#86efac,#4ade80)'
                border = '#22c55e'
                textClr = '#166534'
                shadow = '0 2px 8px rgba(34,197,94,.25)'
              } else if (isToday) {
                bg = 'linear-gradient(135deg,#fed7aa,#fbbf24)'
                border = '#f97316'
                textClr = '#92400e'
                shadow = '0 3px 12px rgba(249,115,22,.3)'
              } else if (isPast && total > 0) {
                bg = 'rgba(254,202,202,.5)'
                border = 'rgba(239,68,68,.3)'
                textClr = '#ef4444'
              }
              if (isSelected && hasPlan) {
                shadow = `0 4px 16px ${isComplete ? 'rgba(34,197,94,.4)' : isToday ? 'rgba(249,115,22,.4)' : 'rgba(0,0,0,.12)'}`
              }

              return (
                <button
                  key={date}
                  type="button"
                  disabled={!hasPlan}
                  onClick={() => {
                    if (hasPlan) onSelectDate(date)
                  }}
                  className="flex flex-col items-center rounded-[14px] px-1 py-2.5 text-center transition-all duration-200 disabled:cursor-default enabled:cursor-pointer enabled:hover:scale-105"
                  style={{
                    background: bg,
                    border: `2px solid ${border}`,
                    boxShadow: shadow,
                    transform: isSelected && hasPlan ? 'scale(1.08)' : undefined,
                    opacity: hasPlan ? 1 : 0.7,
                  }}
                  title={hasPlan ? dayLabel(date) : '本日无计划'}
                >
                  <div className="mb-0.5 text-[9px] font-bold" style={{ color: textClr }}>
                    {dayLabel(date)}
                  </div>
                  <div className="text-[14px] font-extrabold" style={{ color: textClr }}>
                    {fmtDate(date).split('/')[1]}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold" style={{ color: textClr }}>
                    {!hasPlan ? '—' : isComplete ? '⭐' : total > 0 ? `${done}/${total}` : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <PlanPreviewCalendar
          plan={plan}
          problemSets={problemSets}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            if (date) onSelectDate(date)
          }}
          showDayDetail={false}
        />
      )}
    </div>
  )
}
