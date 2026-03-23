'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useMathWeeklyPlan } from '@/hooks/useMathWeeklyPlan'
import { useProblemMastery } from '@/hooks/useProblemMastery'
import { useMathSolved } from '@/hooks/useMathSolved'
import { buildMathWeeklyPlan, getMathReviewProblemsForDay } from '@/utils/math-helpers'
import ProblemMasteryPanel from './ProblemMasteryPanel'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet } from '@/utils/type'

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSONS = [
  { id: '35', label: '第35讲 · 归一问题', short: '归一问题', emoji: '🐦', color: '#3b82f6', bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.25)', desc: '单归一、双归一、反向归一' },
  { id: '36', label: '第36讲 · 星期几问题', short: '星期几', emoji: '📅', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.3)', desc: '同月/跨月/跨年推算' },
]

const CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const ALL_DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' },
  { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

const SECTION_EMOJI: Record<string, string> = {
  lesson: '📖', homework: '✏️', workbook: '📚', pretest: '📝',
}
const SECTION_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  lesson:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  homework: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  workbook: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  pretest:  { bg: '#fdf4ff', text: '#6b21a8', border: '#e9d5ff' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

function fmtWeekRange(weekStart: string, startDay: number): string {
  const [y, m, day] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, day + 6)
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return `${fmtDate(weekStart)} ${CN_DAYS[startDay]} — ${fmtDate(endStr)} ${CN_DAYS[(startDay + 6) % 7]}`
}

function dayLabel(dateStr: string): string {
  return CN_DAYS[new Date(dateStr + 'T00:00:00').getDay()]
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  problemSets: Record<string, ProblemSet>
}

type Phase = 'setup' | 'week-view'

export default function MathWeeklyPractice({ problemSets }: Props) {
  const { user } = useAuth()
  const {
    weeklyPlan, allPriorKeys, priorProblemMap, currentWeekStart,
    defaultParams,
    savePlan, addDoneKey,
    isLoading,
  } = useMathWeeklyPlan(user)
  const { masteryMap, recordProblemResult } = useProblemMastery(user)
  const { solveCount } = useMathSolved(user)

  const [phase, setPhase] = useState<Phase>('setup')
  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [problemsPerDay, setProblemsPerDay] = useState<number>(3)
  const [showParamsDialog, setShowParamsDialog] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState('36')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [reviewKeys, setReviewKeys] = useState<Record<string, string[]>>({})
  const [justCompleted, setJustCompleted] = useState(false)
  const today = todayStr()

  // Sync local params from defaultParams once loaded
  useEffect(() => {
    if (defaultParams) {
      setWeekStartDay(defaultParams.weekStartDay)
      setProblemsPerDay(defaultParams.problemsPerDay)
    }
  }, [defaultParams])

  // Auto-open params dialog when no plan exists
  useEffect(() => {
    if (!isLoading && !weeklyPlan && defaultParams) setShowParamsDialog(true)
  }, [isLoading, weeklyPlan, defaultParams])

  // Auto-switch to week-view if plan exists for current week
  useEffect(() => {
    if (!isLoading && weeklyPlan && currentWeekStart && weeklyPlan.weekStart === currentWeekStart && !showParamsDialog) {
      setPhase('week-view')
      const todayDay = weeklyPlan.days.find(d => d.date === today)
      setSelectedDate(todayDay ? today : (weeklyPlan.days[0]?.date ?? null))
    }
  }, [isLoading, weeklyPlan, currentWeekStart, today, showParamsDialog])

  // Build review keys per day
  useEffect(() => {
    if (!weeklyPlan) return
    // All current-week problems as candidates (in addition to prior-week problems)
    const currentWeekKeys = weeklyPlan.days.flatMap(d =>
      [...d.problems, ...d.optionalProblems].map(p => p.key)
    )
    const allCandidateKeys = [...allPriorKeys, ...currentWeekKeys]
    const rv: Record<string, string[]> = {}
    for (const day of weeklyPlan.days) {
      // Only exclude THIS day's own problems, not the whole week
      const thisDayKeys = new Set([
        ...day.problems.map(p => p.key),
        ...day.optionalProblems.map(p => p.key),
      ])
      rv[day.date] = getMathReviewProblemsForDay(day.date, allCandidateKeys, masteryMap, thisDayKeys)
    }
    setReviewKeys(rv)
  }, [weeklyPlan, allPriorKeys, masteryMap])

  // Reconcile plan progress with actual solve data from Supabase
  useEffect(() => {
    if (!weeklyPlan || isLoading) return
    for (const day of weeklyPlan.days) {
      const doneSet = new Set((weeklyPlan.progress[day.date] ?? { doneKeys: [] }).doneKeys)
      for (const prob of [...day.problems, ...day.optionalProblems]) {
        if ((solveCount[prob.problemId] ?? 0) > 0 && !doneSet.has(prob.key)) {
          void addDoneKey(day.date, prob.key)
          recordProblemResult(prob.key, true)
        }
      }
    }
  }, [weeklyPlan, solveCount, isLoading, addDoneKey, recordProblemResult])

  // Check all-done for today celebration
  useEffect(() => {
    if (!weeklyPlan || !selectedDate) return
    const todayPlan = weeklyPlan.days.find(d => d.date === selectedDate)
    if (!todayPlan || todayPlan.problems.length === 0) return
    const prog = weeklyPlan.progress[selectedDate] ?? { doneKeys: [] }
    const allDone = todayPlan.problems.every(p => prog.doneKeys.includes(p.key))
    setJustCompleted(allDone)
  }, [weeklyPlan, selectedDate])

  const handleCreatePlan = useCallback(async () => {
    if (!currentWeekStart) return
    const ps = problemSets[selectedLesson]
    if (!ps) return
    const plan: MathWeeklyPlan = {
      weekStart: currentWeekStart,
      lessonId: selectedLesson,
      weekStartDay,
      problemsPerDay,
      days: buildMathWeeklyPlan(selectedLesson, ps, currentWeekStart, problemsPerDay),
      progress: {},
    }
    await savePlan(plan)
    setShowParamsDialog(false)
    setPhase('week-view')
    setSelectedDate(today)
  }, [problemSets, selectedLesson, currentWeekStart, problemsPerDay, weekStartDay, savePlan, today])

  const allPlanProblems: MathPlanProblem[] = useMemo(() => {
    const cur = weeklyPlan ? weeklyPlan.days.flatMap(d => [...d.problems, ...d.optionalProblems]) : []
    const prior = Object.values(priorProblemMap)
    const seen = new Set<string>()
    return [...cur, ...prior].filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true })
  }, [weeklyPlan, priorProblemMap])

  // Combined map for review item lookup: prior weeks + current week
  const allProblemMap = useMemo(() => {
    const map: Record<string, MathPlanProblem> = { ...priorProblemMap }
    if (weeklyPlan) {
      for (const day of weeklyPlan.days) {
        for (const p of [...day.problems, ...day.optionalProblems]) {
          map[p.key] = p
        }
      }
    }
    return map
  }, [weeklyPlan, priorProblemMap])

  // ── Loading overlay ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(255,248,240,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div className="text-5xl animate-bounce-slow">⭐</div>
        <div className="text-[14px] font-bold text-orange-400">正在加载中…</div>
      </div>
    )
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  if (showParamsDialog) {
    const sel = LESSONS.find(l => l.id === selectedLesson)!
    const totalRequired = [
      ...(problemSets[selectedLesson]?.lesson ?? []),
      ...(problemSets[selectedLesson]?.homework ?? []),
      ...(problemSets[selectedLesson]?.workbook.slice(0, 6) ?? []),
      ...(problemSets[selectedLesson]?.pretest ?? []),
    ].length
    const days = Math.ceil(totalRequired / problemsPerDay)

    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      >
        <div className="mx-auto max-w-[520px] px-4 py-8">
          {/* Fun header */}
          <div className="mb-7 text-center">
            <div className="inline-flex items-center gap-3 mb-2">
              <span className="text-4xl animate-wiggle inline-block">🚀</span>
              <div>
                <div className="text-[22px] font-extrabold text-orange-800 leading-tight">本周冒险计划</div>
                <div className="text-[12px] text-orange-500 font-medium">{currentWeekStart && fmtWeekRange(currentWeekStart, weekStartDay)}</div>
              </div>
            </div>
          </div>

          {/* Lesson selector */}
          <div className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">选择本周关卡</span>
              <div className="flex-1 h-px bg-orange-100" />
            </div>
            <div className="flex flex-col gap-3">
              {LESSONS.map(l => {
                const isSelected = selectedLesson === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLesson(l.id)}
                    className="group relative flex items-center gap-4 rounded-[16px] px-4 py-4 text-left transition-all duration-200 cursor-pointer"
                    style={{
                      background: isSelected ? l.bg : 'rgba(255,255,255,.7)',
                      border: `2px solid ${isSelected ? l.border : 'rgba(0,0,0,.06)'}`,
                      boxShadow: isSelected ? `0 4px 20px ${l.color}20` : '0 2px 8px rgba(0,0,0,.04)',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                    }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-2xl transition-transform group-hover:scale-110"
                      style={{ background: l.bg, border: `1.5px solid ${l.border}` }}
                    >
                      {l.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-extrabold text-gray-800 leading-tight">{l.label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{l.desc}</div>
                    </div>
                    <div
                      className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[13px] font-extrabold transition-all"
                      style={{
                        background: isSelected ? l.color : 'rgba(0,0,0,.06)',
                        color: isSelected ? 'white' : 'transparent',
                        transform: isSelected ? 'scale(1.1)' : 'scale(0.8)',
                      }}
                    >
                      ✓
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview card */}
          <div
            className="mb-5 rounded-[14px] px-4 py-3.5"
            style={{ background: 'rgba(251,146,60,.08)', border: '1.5px dashed rgba(251,146,60,.4)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px]">🗺️</span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600">冒险预览</span>
            </div>
            <div className="text-[13px] text-orange-800 font-medium">
              共 <span className="font-extrabold text-[15px]">{totalRequired}</span> 道必做题
              <span className="mx-1.5 text-orange-300">·</span>
              每天 <span className="font-extrabold text-[15px]">{problemsPerDay}</span> 题
              <span className="mx-1.5 text-orange-300">·</span>
              约 <span className="font-extrabold text-[15px]">{days}</span> 天完成 🎉
            </div>
          </div>

          {/* Settings */}
          <div
            className="mb-6 rounded-[16px] px-4 py-4"
            style={{ background: 'rgba(255,255,255,.7)', border: '1.5px solid rgba(0,0,0,.06)' }}
          >
            <div className="mb-4">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">每天几道题？</div>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setProblemsPerDay(n)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold transition-all cursor-pointer hover:scale-105"
                    style={{
                      background: problemsPerDay === n ? 'linear-gradient(135deg, #f97316, #fbbf24)' : 'rgba(0,0,0,.05)',
                      color: problemsPerDay === n ? 'white' : '#9ca3af',
                      boxShadow: problemsPerDay === n ? '0 3px 10px rgba(249,115,22,.4)' : 'none',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">每周从哪天开始？</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeekStartDay(opt.value)}
                    className="rounded-full px-3 py-1.5 text-[12px] font-bold transition-all cursor-pointer hover:scale-105"
                    style={{
                      background: weekStartDay === opt.value ? 'linear-gradient(135deg, #f97316, #fbbf24)' : 'rgba(0,0,0,.05)',
                      color: weekStartDay === opt.value ? 'white' : '#9ca3af',
                      boxShadow: weekStartDay === opt.value ? '0 3px 10px rgba(249,115,22,.4)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreatePlan}
              className="group relative flex-1 overflow-hidden rounded-[16px] py-4 text-[15px] font-extrabold text-white transition-all cursor-pointer hover:scale-[1.02] hover:shadow-[0_8px_28px_rgba(249,115,22,.45)] active:scale-[.98]"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="text-xl group-hover:animate-wiggle inline-block">🚀</span>
                出发冒险！
              </span>
              <div className="absolute inset-0 rounded-[16px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)' }} />
            </button>
            {weeklyPlan && (
              <button
                type="button"
                onClick={() => setShowParamsDialog(false)}
                className="rounded-[16px] px-5 text-[14px] font-bold text-gray-400 transition-all cursor-pointer hover:text-gray-600"
                style={{ background: 'rgba(0,0,0,.05)', border: '1.5px solid rgba(0,0,0,.06)' }}
              >
                取消
              </button>
            )}
          </div>
        </div>

        {allPlanProblems.length > 0 && (
          <ProblemMasteryPanel problems={allPlanProblems} masteryMap={masteryMap} />
        )}
      </div>
    )
  }

  // ── Week View ───────────────────────────────────────────────────────────────
  if (!weeklyPlan) return null

  const lessonInfo = LESSONS.find(l => l.id === weeklyPlan.lessonId) ?? LESSONS[0]
  const dayPlan = selectedDate ? weeklyPlan.days.find(d => d.date === selectedDate) : null
  const dayProgress = weeklyPlan.progress[selectedDate ?? ''] ?? { doneKeys: [] }
  const doneKeys = new Set(dayProgress.doneKeys)

  const todayRequired = dayPlan?.problems ?? []
  const todayDone = todayRequired.filter(p => doneKeys.has(p.key)).length
  const pct = todayRequired.length > 0 ? Math.round((todayDone / todayRequired.length) * 100) : 0

  return (
    <>
      <div className="mx-auto max-w-[640px] px-4 py-6">

        {/* Week header */}
        <div
          className="mb-5 rounded-[20px] px-5 py-4"
          style={{
            background: `linear-gradient(135deg, ${lessonInfo.bg}, rgba(255,255,255,.5))`,
            border: `2px solid ${lessonInfo.border}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lessonInfo.emoji}</span>
              <div>
                <div className="text-[16px] font-extrabold text-gray-800">{lessonInfo.short}</div>
                <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                  {fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowParamsDialog(true)}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-gray-400 transition-all cursor-pointer hover:text-gray-600 hover:scale-105"
              style={{ background: 'rgba(255,255,255,.7)', border: '1.5px solid rgba(0,0,0,.08)' }}
            >
              换课 ✏️
            </button>
          </div>
        </div>

        {/* 7-day stepping stones */}
        <div className="mb-5">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400 mb-3 flex items-center gap-2">
            <span>🗺️</span> 本周地图
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weeklyPlan.days.map((day, idx) => {
              const prog = weeklyPlan.progress[day.date] ?? { doneKeys: [] }
              const total = day.problems.length
              const done = prog.doneKeys.filter(k => day.problems.some(p => p.key === k)).length
              const isToday = day.date === today
              const isPast = day.date < today
              const isSelected = day.date === selectedDate
              const isComplete = total > 0 && done >= total

              let bg = 'rgba(255,255,255,.7)'
              let border = 'rgba(0,0,0,.08)'
              let textClr = '#9ca3af'
              let shadow = 'none'

              if (isComplete) { bg = 'linear-gradient(135deg,#86efac,#4ade80)'; border = '#22c55e'; textClr = '#166534'; shadow = '0 2px 8px rgba(34,197,94,.25)' }
              else if (isToday) { bg = 'linear-gradient(135deg,#fed7aa,#fbbf24)'; border = '#f97316'; textClr = '#92400e'; shadow = '0 3px 12px rgba(249,115,22,.3)' }
              else if (isPast && total > 0) { bg = 'rgba(254,202,202,.5)'; border = 'rgba(239,68,68,.3)'; textClr = '#ef4444' }
              if (isSelected) { shadow = `0 4px 16px ${isComplete ? 'rgba(34,197,94,.4)' : isToday ? 'rgba(249,115,22,.4)' : 'rgba(0,0,0,.12)'}` }

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className="flex flex-col items-center rounded-[14px] py-2.5 px-1 text-center transition-all duration-200 cursor-pointer hover:scale-105"
                  style={{
                    background: bg,
                    border: `2px solid ${border}`,
                    boxShadow: shadow,
                    transform: isSelected ? 'scale(1.08)' : undefined,
                  }}
                >
                  <div className="text-[9px] font-bold mb-0.5" style={{ color: textClr }}>{dayLabel(day.date)}</div>
                  <div className="text-[14px] font-extrabold" style={{ color: textClr }}>
                    {fmtDate(day.date).split('/')[1]}
                  </div>
                  <div className="text-[10px] mt-0.5 font-bold" style={{ color: textClr }}>
                    {isComplete ? '⭐' : total > 0 ? `${done}/${total}` : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Today shortcut */}
        {selectedDate !== today && weeklyPlan.days.some(d => d.date === today) && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="mb-4 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all cursor-pointer hover:scale-105"
            style={{ background: 'rgba(249,115,22,.1)', color: '#ea580c', border: '1.5px solid rgba(249,115,22,.25)' }}
          >
            📍 跳到今天
          </button>
        )}

        {/* Day detail */}
        {dayPlan && (
          <div className="space-y-5">

            {/* Progress bar */}
            {todayRequired.length > 0 && (
              <div
                className="rounded-[16px] px-4 py-4"
                style={{ background: 'rgba(255,255,255,.8)', border: '1.5px solid rgba(0,0,0,.06)', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}
              >
                {justCompleted ? (
                  <div className="flex items-center justify-center gap-3 py-1">
                    <span className="text-2xl animate-star-pop inline-block">🎉</span>
                    <div>
                      <div className="text-[15px] font-extrabold text-green-600">今天全部完成啦！</div>
                      <div className="text-[12px] text-green-500 font-medium">你真棒！明天继续加油 ⭐</div>
                    </div>
                    <span className="text-2xl animate-star-pop inline-block" style={{ animationDelay: '.15s' }}>⭐</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-extrabold text-gray-500">今日进度</div>
                      <div className="text-[13px] font-extrabold" style={{ color: pct === 100 ? '#16a34a' : '#f97316' }}>
                        {todayDone}/{todayRequired.length} 题
                      </div>
                    </div>
                    <div className="relative h-4 w-full overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,.06)' }}>
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                          boxShadow: pct > 0 ? '0 0 8px rgba(249,115,22,.5)' : 'none',
                        }}
                      />
                      {/* Star runner */}
                      {pct > 5 && pct < 100 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 text-[12px] transition-all duration-700"
                          style={{ left: `calc(${pct}% - 10px)` }}
                        >
                          ⭐
                        </div>
                      )}
                    </div>
                    {pct > 0 && pct < 100 && (
                      <div className="mt-1.5 text-[11px] text-orange-400 font-medium">
                        再做 {todayRequired.length - todayDone} 题就完成啦！
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Required problems */}
            <div>
              <SectionHeader icon="🎯" label="必做题" count={dayPlan.problems.length} />
              {dayPlan.problems.length > 0 ? (
                <div className="space-y-2.5">
                  {dayPlan.problems.map(prob => (
                    <ProblemCard
                      key={prob.key}
                      prob={prob}
                      done={doneKeys.has(prob.key)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyDay />
              )}
            </div>

            {/* Review problems */}
            {(reviewKeys[selectedDate!]?.length ?? 0) > 0 && (
              <div>
                <SectionHeader icon="🔄" label="旧讲复习" count={reviewKeys[selectedDate!].length} accent="#f59e0b" />
                <div className="space-y-2.5">
                  {reviewKeys[selectedDate!].map(key => {
                    const found = allProblemMap[key]
                    if (!found) return null
                    return (
                      <ProblemCard
                        key={key}
                        prob={found}
                        done={doneKeys.has(key)}
                        isReview
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Optional problems */}
            {dayPlan.optionalProblems.length > 0 && (
              <OptionalSection
                problems={dayPlan.optionalProblems}
                doneKeys={doneKeys}
              />
            )}
          </div>
        )}
      </div>

      {/* Mastery panel */}
      {allPlanProblems.length > 0 && (
        <div className="mt-4">
          <ProblemMasteryPanel problems={allPlanProblems} masteryMap={masteryMap} />
        </div>
      )}
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count, accent = '#6b7280' }: { icon: string; label: string; count: number; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <span className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
        style={{ background: `${accent}15`, color: accent }}
      >
        {count} 题
      </span>
      <div className="flex-1 h-px" style={{ background: `${accent}20` }} />
    </div>
  )
}

function EmptyDay() {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-[14px] py-6 text-center"
      style={{ background: 'rgba(0,0,0,.03)', border: '1.5px dashed rgba(0,0,0,.08)' }}
    >
      <span className="text-2xl">😴</span>
      <div className="text-[12px] text-gray-400 font-medium">今天没有安排，好好休息！</div>
    </div>
  )
}

function ProblemCard({
  prob, done, isReview,
}: {
  prob: MathPlanProblem
  done: boolean
  isReview?: boolean
}) {
  const sc = SECTION_COLOR[prob.section] ?? SECTION_COLOR.lesson

  return (
    <div
      className="group flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all duration-300"
      style={{
        background: done ? 'rgba(220,252,231,.6)' : 'rgba(255,255,255,.85)',
        border: `1.5px solid ${done ? '#86efac' : 'rgba(0,0,0,.07)'}`,
        boxShadow: done ? 'none' : '0 2px 10px rgba(0,0,0,.04)',
      }}
    >
      {/* Done indicator */}
      <div
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: done ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(0,0,0,.05)',
          border: done ? 'none' : '2px solid rgba(0,0,0,.1)',
          boxShadow: done ? '0 2px 8px rgba(34,197,94,.4)' : 'none',
        }}
      >
        {done && <span className="text-white text-[14px] font-extrabold">✓</span>}
      </div>

      {/* Section badge */}
      <div
        className="shrink-0 flex items-center justify-center h-7 w-7 rounded-[8px] text-[14px]"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        {SECTION_EMOJI[prob.section] ?? '📋'}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-bold leading-snug ${done ? 'text-green-600 line-through opacity-70' : 'text-gray-800'}`}>
          {prob.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-medium" style={{ color: sc.text }}>
            第{prob.lessonId}讲
          </span>
          {isReview && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(245,158,11,.12)', color: '#b45309' }}
            >
              复习
            </span>
          )}
        </div>
      </div>

      {/* Do button */}
      {!done && (
        <Link
          href={`/math/ny/${prob.lessonId}/${prob.section}/${prob.index}`}
          className="shrink-0 flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(249,115,22,.4)]"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          做题 ✨
        </Link>
      )}
      {done && (
        <span className="text-[20px] animate-star-pop inline-block shrink-0">⭐</span>
      )}
    </div>
  )
}

function OptionalSection({
  problems, doneKeys,
}: {
  problems: MathPlanProblem[]
  doneKeys: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const doneCount = problems.filter(p => doneKeys.has(p.key)).length

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left transition-all cursor-pointer hover:bg-black/3"
        style={{ border: '1.5px dashed rgba(0,0,0,.1)' }}
      >
        <span className="text-base">🌟</span>
        <span className="text-[12px] font-extrabold uppercase tracking-wider text-gray-400">
          选做题 · {problems.length} 题
        </span>
        {doneCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-extrabold text-yellow-700">
            已做 {doneCount}
          </span>
        )}
        <span className="ml-auto text-gray-300 text-[12px] transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </button>
      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          {problems.map(prob => (
            <ProblemCard
              key={prob.key}
              prob={prob}
              done={doneKeys.has(prob.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
