'use client'

import { useMemo, useState } from 'react'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet } from '@rosie/core'
import {
  PlanPreviewCalendar,
  mondayWeekDates,
  dayLabel,
  fmtDate,
  uniqueDayTypeChips,
} from './math-weekly-plan-shared'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'

export type MapMode = 'week' | 'month'

type Props = {
  plan: MathWeeklyPlan
  problemSets?: Record<string, ProblemSet>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  today: string
  mode?: MapMode
  onModeChange?: (mode: MapMode) => void
  onPracticeProblem?: (prob: MathPlanProblem, dayProblems: MathPlanProblem[]) => void
  /** Extra element rendered in the header row, next to the 周/月 tabs (e.g. "跳到今天" shortcut). */
  headerExtra?: React.ReactNode
}

const WEEK_HEADER = ['一', '二', '三', '四', '五', '六', '日']

function WeekDayChipStack({
  chips,
  className,
  isComplete,
  textClr,
  total,
  max = 4,
}: {
  chips: string[]
  className?: string
  isComplete: boolean
  textClr: string
  total: number
  max?: number
}) {
  const shown = chips.slice(0, max)
  const extra = chips.length - shown.length
  return (
    <div className={className}>
      {shown.map((chip) => (
        <div
          key={chip}
          className="rounded px-0.5 py-0.5 text-[8px] leading-snug font-bold break-words md:text-[9px]"
          style={{
            background: isComplete ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.85)',
            color: isComplete ? '#166534' : '#7c2d12',
          }}
          title={chip}
        >
          {chip}
        </div>
      ))}
      {extra > 0 && (
        <div className="text-[8px] font-bold" style={{ color: textClr }}>
          +{extra}
        </div>
      )}
      {total > 0 && shown.length === 0 && (
        <div className="text-[9px] font-medium" style={{ color: textClr }}>
          {total} 题
        </div>
      )}
    </div>
  )
}

export default function MathPlanMap({
  plan,
  problemSets,
  selectedDate,
  onSelectDate,
  today,
  mode: controlledMode,
  onModeChange,
  onPracticeProblem,
  headerExtra,
}: Props) {
  const [internalMode, setInternalMode] = useState<MapMode>('week')
  const mode = controlledMode ?? internalMode
  const setMode = (next: MapMode) => {
    onModeChange?.(next)
    if (controlledMode == null) setInternalMode(next)
  }
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
        <div className="flex items-center gap-2">
          {headerExtra}
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
              const problems = day?.problems ?? []
              const total = problems.length
              const hasPlan = Boolean(day)
              const prog = plan.progress[date] ?? { doneKeys: [] }
              const done = hasPlan
                ? problems.filter((problem) => isPlanProblemDone(problem, date, prog.doneKeys)).length
                : 0
              const isToday = date === today
              const isPast = date < today
              const isSelected = date === selectedDate
              const isComplete = hasPlan && total > 0 && done >= total
              const isDeferredDay = problems.some((problem) => problem.isDeferred)
              const deferredSourceIds = new Set(
                (plan.deferredBatches ?? []).flatMap((batch) => batch.sourceAssignmentIds),
              )
              const isDeferredSourceDay = problems.some((problem) =>
                deferredSourceIds.has(problem.assignmentId ?? `${date}::${problem.key}`),
              )
              const compactChips = hasPlan
                ? uniqueDayTypeChips(problems, problemSets, { compact: true })
                : []
              const fullChips = hasPlan ? uniqueDayTypeChips(problems, problemSets) : []

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
              } else if (isPast && total > 0 && done < total) {
                bg = 'rgba(254,202,202,.5)'
                border = 'rgba(239,68,68,.3)'
                textClr = '#ef4444'
              } else if (isDeferredDay) {
                bg = 'rgba(221,214,254,.65)'
                border = 'rgba(124,58,237,.42)'
                textClr = '#6d28d9'
              } else if (hasPlan) {
                bg = 'rgba(251,146,60,.1)'
                border = 'rgba(251,146,60,.22)'
                textClr = '#c2410c'
              }
              if (isSelected && hasPlan) {
                border = isComplete ? '#16a34a' : '#ea580c'
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
                  className="flex min-h-24 flex-col rounded-[14px] px-1 py-1.5 text-left transition-all duration-200 disabled:cursor-default enabled:cursor-pointer md:min-h-28 md:px-1.5 md:py-2"
                  style={{
                    background: bg,
                    border: `2px solid ${border}`,
                    boxShadow: shadow,
                    transform: isSelected && hasPlan ? 'scale(1.03)' : undefined,
                    opacity: hasPlan ? 1 : 0.7,
                  }}
                  title={hasPlan ? dayLabel(date) : '本日无计划'}
                >
                  <div className="flex items-baseline justify-between gap-0.5">
                    <span className="text-[10px] font-bold md:text-[11px]" style={{ color: textClr }}>
                      {dayLabel(date)}
                      <span className="ml-0.5 font-extrabold">
                        {fmtDate(date).split('/')[1]}
                      </span>
                    </span>
                    {hasPlan && total > 0 && (
                      <span className="shrink-0 text-[9px] font-bold" style={{ color: textClr }}>
                        {isComplete ? '⭐' : `${done}/${total}`}
                      </span>
                    )}
                  </div>
                  {hasPlan ? (
                    <>
                      <div className="mt-0.5 text-[8px] font-extrabold" style={{ color: textClr }}>
                        {isComplete ? (isDeferredDay ? '延期完成' : '已完成') : isDeferredSourceDay ? '过期·已延期' : isPast ? '已过期' : isDeferredDay ? '延期任务' : '未执行'}
                      </div>
                      {/* Mobile: 讲次短名 only, e.g. 7数字谜 */}
                      <WeekDayChipStack
                        chips={compactChips}
                        className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 md:hidden"
                        isComplete={isComplete}
                        textClr={textClr}
                        total={total}
                      />
                      {/* Desktop: include specific tagLabel */}
                      <WeekDayChipStack
                        chips={fullChips}
                        className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 md:flex"
                        isComplete={isComplete}
                        textClr={textClr}
                        total={total}
                      />
                    </>
                  ) : (
                    <div className="mt-2 text-center text-[10px] font-bold" style={{ color: textClr }}>
                      —
                    </div>
                  )}
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
          onPracticeProblem={onPracticeProblem}
        />
      )}
    </div>
  )
}
