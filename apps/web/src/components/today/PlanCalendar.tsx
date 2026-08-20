'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth, todayStr } from '@rosie/core'
import { useWeeklyPlan, useAdaptiveWordPlan } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'
import { useCalcSessionSummaries } from '@rosie/calc'
import { useChineseRoadmapPlan } from '@rosie/chinese'
import { useAdaptiveDailyHistory } from './useAdaptiveDailyHistory'

type SubjectKey = 'calc' | 'english' | 'math' | 'chinese'
type DotState = 'done' | 'partial' | 'todo'

type DayMark = {
  key: SubjectKey
  state: DotState
  /** Future plan days render muted. */
  future: boolean
}

const SUBJECT_META: Array<{ key: SubjectKey; icon: string; label: string; color: string }> = [
  { key: 'calc', icon: '🧮', label: '口算', color: '#8b5cf6' },
  { key: 'english', icon: '📖', label: '英语', color: '#10b981' },
  { key: 'math', icon: '📐', label: '数学', color: '#f97316' },
  { key: 'chinese', icon: '📜', label: '语文', color: '#f59e0b' },
]

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function monthOf(date: string): string {
  return date.slice(0, 7)
}

type PlanCalendarProps = {
  selectedDate: string
  onSelectDate: (date: string) => void
}

/**
 * Cross-subject plan calendar: month grid where every day is marked with one
 * dot per subject (口算/英语/数学/语文) reflecting that day's completion.
 * Picking a day drives the day-detail dashboard below.
 */
export default function PlanCalendar({ selectedDate, onSelectDate }: PlanCalendarProps) {
  const { user } = useAuth()
  const today = todayStr()

  const { weeklyPlan: englishPlan } = useWeeklyPlan(user)
  const { plans: adaptivePlans } = useAdaptiveWordPlan(user)
  const adaptivePlan = useMemo(
    () => adaptivePlans.find((p) => p.status === 'active') ?? null,
    [adaptivePlans],
  )
  const { history: adaptiveHistory } = useAdaptiveDailyHistory(user, adaptivePlan?.id ?? null)
  const { weeklyPlan: mathPlan } = useMathWeeklyPlan(user)
  const { sessions: calcSessions, target: calcTarget } = useCalcSessionSummaries(user)
  const {
    activePlan: chineseActivePlan,
    completedPlan: chineseCompletedPlan,
    loadRunsForPlan,
    runsByPlanId,
  } = useChineseRoadmapPlan(user)

  const chineseFocusPlan = chineseActivePlan ?? chineseCompletedPlan
  useEffect(() => {
    if (chineseFocusPlan) void loadRunsForPlan(chineseFocusPlan.id)
  }, [chineseFocusPlan, loadRunsForPlan])

  // ── Per-date lookup maps ──
  const calcByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of calcSessions) {
      const n = (s.correct_count ?? 0) + (s.retry_count ?? 0) + (s.wrong_count ?? 0)
      map.set(s.date, (map.get(s.date) ?? 0) + n)
    }
    return map
  }, [calcSessions])

  const englishQuizDoneByDate = useMemo(() => {
    const map = new Map<string, boolean>()
    if (!englishPlan) return map
    for (const day of englishPlan.days) {
      map.set(day.date, englishPlan.progress[day.date]?.quizDone === true)
    }
    return map
  }, [englishPlan])

  const chineseRunDates = useMemo(() => {
    const set = new Set<string>()
    for (const runs of Object.values(runsByPlanId)) {
      for (const run of runs) set.add(run.finishedAt.slice(0, 10))
    }
    return set
  }, [runsByPlanId])

  // ── Month range: any month holding plan days, practice sessions or runs ──
  const months = useMemo(() => {
    const set = new Set<string>()
    set.add(monthOf(today))
    if (englishPlan) for (const d of englishPlan.days) set.add(monthOf(d.date))
    if (mathPlan) for (const d of mathPlan.days) set.add(monthOf(d.date))
    for (const s of calcSessions) set.add(monthOf(s.date))
    for (const date of chineseRunDates) set.add(monthOf(date))
    if (chineseActivePlan) set.add(monthOf(chineseActivePlan.createdAt.slice(0, 10)))
    return [...set].sort()
  }, [today, englishPlan, mathPlan, calcSessions, chineseRunDates, chineseActivePlan])

  const [monthIdx, setMonthIdx] = useState(() =>
    Math.max(0, months.indexOf(monthOf(today))),
  )
  // Keep index valid while data (and thus the month list) is still loading.
  const safeIdx = Math.min(monthIdx, Math.max(0, months.length - 1))
  const viewMonth = months[safeIdx] ?? monthOf(today)

  useEffect(() => {
    setMonthIdx(Math.max(0, months.indexOf(monthOf(selectedDate))))
    // Only re-sync when the month list itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.join(',')])

  const marksForDate = (date: string): DayMark[] => {
    const marks: DayMark[] = []
    const future = date > today

    // 口算 — no explicit plan; mark days with sessions (plus today's target).
    const calcDone = calcByDate.get(date)
    if (calcDone != null) {
      marks.push({ key: 'calc', state: calcDone >= calcTarget ? 'done' : 'partial', future })
    } else if (date === today) {
      marks.push({ key: 'calc', state: 'todo', future: false })
    }

    // 英语 — weekly plan day first, adaptive history otherwise.
    if (englishQuizDoneByDate.has(date)) {
      marks.push({
        key: 'english',
        state: englishQuizDoneByDate.get(date) ? 'done' : 'todo',
        future,
      })
    } else if (adaptivePlan) {
      const row = adaptiveHistory?.get(date)
      if (row) marks.push({ key: 'english', state: row.allDone ? 'done' : 'partial', future })
      else if (date === today) marks.push({ key: 'english', state: 'todo', future: false })
    }

    // 数学 — per-problem completion within the day's assignment.
    const mathDay = mathPlan?.days.find((d) => d.date === date)
    if (mathDay && mathDay.problems.length > 0 && mathPlan) {
      const doneKeys = mathPlan.progress[date]?.doneKeys ?? []
      const doneCount = mathDay.problems.filter((p) => isPlanProblemDone(p, date, doneKeys)).length
      marks.push({
        key: 'math',
        state:
          doneCount === mathDay.problems.length ? 'done' : doneCount > 0 ? 'partial' : 'todo',
        future,
      })
    }

    // 语文 — a recorded run means done; active-plan days without one are todo.
    if (chineseRunDates.has(date)) {
      marks.push({ key: 'chinese', state: 'done', future: false })
    } else if (
      chineseActivePlan &&
      date <= today &&
      date >= chineseActivePlan.createdAt.slice(0, 10)
    ) {
      marks.push({ key: 'chinese', state: 'todo', future: false })
    }

    return marks
  }

  // ── Grid cells for the visible month (day 1 + leading pad) ──
  const [year, month] = viewMonth.split('-').map(Number) as [number, number]
  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const leadPad = new Date(year, month - 1, 1).getDay()
    const list: Array<{ date: string; dayNum: number } | null> = []
    for (let i = 0; i < leadPad; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ date: `${viewMonth}-${String(d).padStart(2, '0')}`, dayNum: d })
    }
    return list
  }, [year, month, viewMonth])

  return (
    <section
      className="rounded-2xl px-3 py-4 sm:px-4"
      style={{
        background: 'rgba(255,255,255,.75)',
        border: '1.5px solid rgba(251,146,60,.18)',
        boxShadow: '0 4px 16px rgba(251,146,60,.08)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={safeIdx === 0}
          onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
          className="cursor-pointer rounded-full px-3 py-1 text-[13px] font-bold text-orange-400 disabled:cursor-default disabled:opacity-30"
          style={{ background: 'rgba(251,146,60,.08)' }}
        >
          ‹
        </button>
        <span className="text-[14px] font-extrabold text-orange-900">
          {year}年{month}月
        </span>
        <button
          type="button"
          disabled={safeIdx >= months.length - 1}
          onClick={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))}
          className="cursor-pointer rounded-full px-3 py-1 text-[13px] font-bold text-orange-400 disabled:cursor-default disabled:opacity-30"
          style={{ background: 'rgba(251,146,60,.08)' }}
        >
          ›
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-bold text-gray-400">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} className="min-h-2" />
          const marks = marksForDate(cell.date)
          const isSelected = selectedDate === cell.date
          const isToday = cell.date === today
          const allDone = marks.length > 0 && marks.every((m) => m.state === 'done')
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className="min-h-14 cursor-pointer rounded-lg px-1 py-1.5 text-left transition-all sm:min-h-16"
              style={{
                background: isSelected
                  ? 'rgba(251,146,60,.18)'
                  : allDone && !isToday
                    ? 'rgba(134,239,172,.35)'
                    : 'rgba(255,255,255,.6)',
                border: isSelected
                  ? '2px solid rgba(234,88,12,.55)'
                  : isToday
                    ? '1.5px solid rgba(251,146,60,.45)'
                    : '1px solid rgba(0,0,0,.06)',
                boxShadow: isSelected ? '0 2px 10px rgba(249,115,22,.2)' : 'none',
              }}
            >
              <div
                className="text-[11px] font-bold leading-none sm:text-[12px]"
                style={{ color: isToday ? '#ea580c' : '#64748b' }}
              >
                {cell.dayNum}
                {isToday && <span className="ml-0.5 text-[8px]">今</span>}
              </div>
              {marks.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-[3px]">
                  {marks.map((mark) => {
                    const meta = SUBJECT_META.find((m) => m.key === mark.key)!
                    const opacity = mark.future ? 0.4 : 1
                    return (
                      <span
                        key={mark.key}
                        title={`${meta.label}：${mark.state === 'done' ? '已完成' : mark.state === 'partial' ? '部分完成' : '未完成'}`}
                        className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                        style={
                          mark.state === 'done'
                            ? { background: meta.color, opacity }
                            : mark.state === 'partial'
                              ? { background: `${meta.color}66`, opacity }
                              : { border: `1.5px solid ${meta.color}`, opacity }
                        }
                      />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-orange-100 pt-2.5">
        {SUBJECT_META.map((m) => (
          <span key={m.key} className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
        <span className="ml-auto text-[10px] font-medium text-gray-400">
          实心=完成 · 半透明=部分 · 空心=未完成
        </span>
      </div>
    </section>
  )
}
