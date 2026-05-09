'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useMathWeeklyPlan } from '@/hooks/useMathWeeklyPlan'
import { useProblemMastery } from '@/hooks/useProblemMastery'
import { useMathSolved } from '@/hooks/useMathSolved'
import { buildMathWeeklyPlan, getMathReviewProblemsForDay, makeProblem } from '@/utils/math-helpers'
import { getWeekStart } from '@/utils/english-helpers'
import { useMathRotatingReview } from '@/hooks/useMathRotatingReview'
import { useMathWeeklyLessonReview } from '@/hooks/useMathWeeklyLessonReview'
import ProblemMasteryPanel from './ProblemMasteryPanel'
import { todayStr } from '@/utils/constant'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet } from '@/utils/type'

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSONS = [
  {
    id: '34',
    label: '第34讲 · 乘法分配律',
    short: '乘法分配律问题',
    emoji: '🍑',
    color: 'rgba(159,130,246,1)',
    bg: 'rgba(159,130,246,.08)',
    border: 'rgba(159,130,246,.25)',
    desc: '装一袋，分多袋，找好朋友',
  },
  {
    id: '35',
    label: '第35讲 · 归一问题',
    short: '归一问题',
    emoji: '🐦',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,.08)',
    border: 'rgba(59,130,246,.25)',
    desc: '单归一、双归一、反向归一',
  },
  {
    id: '36',
    label: '第36讲 · 星期几问题',
    short: '星期几',
    emoji: '📅',
    color: 'rgba(245,158,11,1)',
    bg: 'rgba(245,158,11,.08)',
    border: 'rgba(245,158,11,.3)',
    desc: '同月/跨月/跨年推算',
  },
  {
    id: '37',
    label: '第37讲 · 鸡兔同笼问题',
    short: '鸡兔同笼',
    emoji: '🐰',
    color: 'rgba(133,200,11,1)',
    bg: 'rgba(133,200,11,.08)',
    border: 'rgba(133,200,11,.3)',
    desc: '找头和，腿和，否则分组',
  },
  {
    id: '38',
    label: '第38讲 · 一笔画',
    short: '一笔画',
    emoji: '✏️',
    color: 'rgba(236,72,153,1)',
    bg: 'rgba(236,72,153,.08)',
    border: 'rgba(236,72,153,.3)',
    desc: '端点·奇点·偶点判断',
  },
  {
    id: '39',
    label: '第39讲 · 盈亏问题',
    short: '盈亏问题',
    emoji: '⚖️',
    color: 'rgba(16,185,129,1)',
    bg: 'rgba(16,185,129,.08)',
    border: 'rgba(16,185,129,.3)',
    desc: '总差额 ÷ 每份差额',
  },
  {
    id: '40',
    label: '第40讲 · 周长问题',
    short: '周长问题',
    emoji: '📐',
    color: 'rgba(99,102,241,1)',
    bg: 'rgba(99,102,241,.08)',
    border: 'rgba(99,102,241,.3)',
    desc: '拼图·剪切·平移·标向',
  },
  {
    id: '41',
    label: '第41讲 · 间隔趣题',
    short: '间隔趣题',
    emoji: '✂️',
    color: 'rgba(249,115,22,1)',
    bg: 'rgba(249,115,22,.08)',
    border: 'rgba(249,115,22,.3)',
    desc: '锯木头·爬楼·敲钟',
  },
]

const CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const ALL_DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

const SECTION_EMOJI: Record<string, string> = {
  lesson: '📖',
  homework: '✏️',
  workbook: '📚',
  pretest: '📝',
}
const SECTION_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  lesson: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  homework: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  workbook: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  pretest: { bg: '#fdf4ff', text: '#6b21a8', border: '#e9d5ff' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

function weekEndDate(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

function fmtWeekRange(weekStart: string, startDay: number): string {
  const endStr = weekEndDate(weekStart)
  return `${fmtDate(weekStart)} ${CN_DAYS[startDay]} — ${fmtDate(endStr)} ${CN_DAYS[(startDay + 6) % 7]}`
}

function dayLabel(dateStr: string): string {
  return CN_DAYS[new Date(dateStr + 'T00:00:00').getDay()]
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  problemSets: Record<string, ProblemSet>
}

export default function MathWeeklyPractice({ problemSets }: Props) {
  const { user } = useAuth()
  const {
    weeklyPlan,
    allPlans,
    allPriorKeys,
    priorProblemMap,
    currentWeekStart,
    defaultParams,
    savePlan,
    addDoneKey,
    deletePlan,
    isLoading,
  } = useMathWeeklyPlan(user)
  const { masteryMap, recordProblemResult } = useProblemMastery(user)
  const { solveCount } = useMathSolved(user)

  const [weekStartDay, setWeekStartDay] = useState<number>(4)
  const [problemsPerDay, setProblemsPerDay] = useState<number>(3)
  const [showParamsDialog, setShowParamsDialog] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState(LESSONS?.slice(-1)[0].id || '37')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('')
  const today = todayStr()

  // Generate week options around today based on weekStartDay
  const weekOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const seen = new Set<string>()
    for (let offset = -1; offset <= 4; offset++) {
      const base = new Date()
      base.setDate(base.getDate() + offset * 7)
      const ws = getWeekStart(base, weekStartDay)
      if (!seen.has(ws)) {
        seen.add(ws)
        options.push({ value: ws, label: fmtWeekRange(ws, weekStartDay) })
      }
    }
    return options
  }, [weekStartDay])

  // Sync local params from defaultParams once loaded (during-render)
  const [syncedDefaultParams, setSyncedDefaultParams] = useState(defaultParams)
  if (syncedDefaultParams !== defaultParams) {
    setSyncedDefaultParams(defaultParams)
    if (defaultParams) {
      setWeekStartDay(defaultParams.weekStartDay)
      setProblemsPerDay(defaultParams.problemsPerDay)
    }
  }
  // Auto-open dialog when no plan exists (during-render)
  const [autoOpenKey, setAutoOpenKey] = useState('')
  const newOpenKey = `${isLoading}|${!!weeklyPlan}|${!!defaultParams}`
  if (autoOpenKey !== newOpenKey) {
    setAutoOpenKey(newOpenKey)
    if (!isLoading && !weeklyPlan && defaultParams) {
      setSelectedWeekStart(currentWeekStart ?? '')
      setShowParamsDialog(true)
    }
  }
  // Auto-select date when plan loads (during-render)
  const [autoSelectKey, setAutoSelectKey] = useState('')
  const newSelectKey = `${isLoading}|${weeklyPlan?.weekStart ?? ''}|${currentWeekStart ?? ''}|${showParamsDialog}`
  if (autoSelectKey !== newSelectKey) {
    setAutoSelectKey(newSelectKey)
    if (
      !isLoading &&
      weeklyPlan &&
      currentWeekStart &&
      weeklyPlan.weekStart === currentWeekStart &&
      !showParamsDialog
    ) {
      const todayDay = weeklyPlan.days.find((d) => d.date === today)
      setSelectedDate(todayDay ? today : (weeklyPlan.days[0]?.date ?? null))
    }
  }

  // Derived: review keys per day
  const reviewKeys = useMemo(() => {
    if (!weeklyPlan) return {} as Record<string, string[]>
    const currentWeekKeys = weeklyPlan.days.flatMap((d) =>
      [...d.problems, ...d.optionalProblems].map((p) => p.key),
    )
    const allCandidateKeys = [...allPriorKeys, ...currentWeekKeys]
    const rv: Record<string, string[]> = {}
    for (const day of weeklyPlan.days) {
      const thisDayKeys = new Set([
        ...day.problems.map((p) => p.key),
        ...day.optionalProblems.map((p) => p.key),
      ])
      rv[day.date] = getMathReviewProblemsForDay(
        day.date,
        allCandidateKeys,
        masteryMap,
        thisDayKeys,
      )
    }
    return rv
  }, [weeklyPlan, allPriorKeys, masteryMap])

  // Derived: all-done celebration flag
  const justCompleted = useMemo(() => {
    if (!weeklyPlan || !selectedDate) return false
    const todayPlan = weeklyPlan.days.find((d) => d.date === selectedDate)
    if (!todayPlan || todayPlan.problems.length === 0) return false
    const prog = weeklyPlan.progress[selectedDate] ?? { doneKeys: [] }
    return todayPlan.problems.every((p) => prog.doneKeys.includes(p.key))
  }, [weeklyPlan, selectedDate])

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

  const handleCreatePlan = useCallback(async () => {
    const targetWeek = selectedWeekStart || currentWeekStart
    if (!targetWeek) return
    const ps = problemSets[selectedLesson]
    if (!ps) return
    // Preserve existing progress when editing the same week
    const existingPlan = allPlans.find((p) => p.weekStart === targetWeek)
    const plan: MathWeeklyPlan = {
      weekStart: targetWeek,
      lessonId: selectedLesson,
      weekStartDay,
      problemsPerDay,
      days: buildMathWeeklyPlan(selectedLesson, ps, targetWeek, problemsPerDay),
      progress: existingPlan?.lessonId === selectedLesson ? (existingPlan.progress ?? {}) : {},
    }
    await savePlan(plan)
    setShowParamsDialog(false)
    if (targetWeek === currentWeekStart) setSelectedDate(today)
  }, [
    problemSets,
    selectedLesson,
    selectedWeekStart,
    currentWeekStart,
    problemsPerDay,
    weekStartDay,
    savePlan,
    today,
    allPlans,
  ])

  const handleCheckProblem = useCallback(
    async (date: string, key: string) => {
      await addDoneKey(date, key)
      recordProblemResult(key, true)
    },
    [addDoneKey, recordProblemResult],
  )

  const openCreateDialog = useCallback(() => {
    setSelectedWeekStart(currentWeekStart ?? '')
    setShowParamsDialog(true)
  }, [currentWeekStart])

  const openEditDialog = useCallback(() => {
    if (weeklyPlan) {
      setSelectedLesson(weeklyPlan.lessonId)
      setWeekStartDay(weeklyPlan.weekStartDay)
      setProblemsPerDay(weeklyPlan.problemsPerDay)
      setSelectedWeekStart(weeklyPlan.weekStart)
    }
    setShowParamsDialog(true)
  }, [weeklyPlan])

  const allPlanProblems: MathPlanProblem[] = useMemo(() => {
    const cur = weeklyPlan
      ? weeklyPlan.days.flatMap((d) => [...d.problems, ...d.optionalProblems])
      : []
    const prior = Object.values(priorProblemMap)
    const seen = new Set<string>()
    return [...cur, ...prior].filter((p) => {
      if (seen.has(p.key)) return false
      seen.add(p.key)
      return true
    })
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

  // All prior lesson problems (lessonId < current), skipping lessons with no problems (e.g. pure animation)
  const priorLessonProbs = useMemo(() => {
    if (!weeklyPlan) return {} as Record<string, MathPlanProblem[]>
    const currentId = Number(weeklyPlan.lessonId)
    const result: Record<string, MathPlanProblem[]> = {}
    for (const [id, ps] of Object.entries(problemSets)) {
      if (Number(id) >= currentId) continue
      const probs = [
        ...ps.lesson.map((p, i) => makeProblem(id, 'lesson', p, i + 1)),
        ...ps.homework.map((p, i) => makeProblem(id, 'homework', p, i + 1)),
        ...ps.pretest.map((p, i) => makeProblem(id, 'pretest', p, i + 1)),
      ]
      if (probs.length > 0) result[id] = probs
    }
    return result
  }, [problemSets, weeklyPlan])

  const dailyRequiredCounts = useMemo(() => {
    if (!weeklyPlan) return {} as Record<string, number>
    return Object.fromEntries(weeklyPlan.days.map((d) => [d.date, d.problems.length]))
  }, [weeklyPlan])

  const {
    reviewProblems: rotatingReviews,
    markReviewDone,
    isCompletedToday,
  } = useMathRotatingReview(
    user,
    weeklyPlan?.lessonId ?? '',
    selectedDate,
    priorLessonProbs,
    masteryMap,
    dailyRequiredCounts,
    problemsPerDay,
  )

  // Detect rotating review completions
  useEffect(() => {
    if (weeklyPlan?.lessonId !== '36') return
    for (const prob of rotatingReviews) {
      if ((solveCount[prob.problemId] ?? 0) > 0 && !isCompletedToday(prob.key)) {
        markReviewDone(prob.key)
      }
    }
  }, [solveCount, rotatingReviews, weeklyPlan?.lessonId, isCompletedToday, markReviewDone])

  const rotatingReviewKeys = useMemo(
    () => new Set(rotatingReviews.map((p) => p.key)),
    [rotatingReviews],
  )

  const {
    todayProblem: weeklyLessonProblem,
    todayLessonId: weeklyLessonId,
    reviewCounts: weeklyLessonReviewCounts,
    isDone: weeklyLessonIsDone,
    isSkipped: weeklyLessonIsSkipped,
    markDone: markWeeklyLessonDone,
    markSkipped: markWeeklyLessonSkipped,
  } = useMathWeeklyLessonReview(
    user,
    weeklyPlan?.lessonId ?? '',
    selectedDate,
    priorLessonProbs,
    rotatingReviewKeys,
  )

  // Detect weekly lesson review completions
  useEffect(() => {
    if (!weeklyLessonProblem || weeklyLessonIsDone) return
    if ((solveCount[weeklyLessonProblem.problemId] ?? 0) > 0) {
      markWeeklyLessonDone(weeklyLessonProblem.key)
    }
  }, [solveCount, weeklyLessonProblem, weeklyLessonIsDone, markWeeklyLessonDone])

  // ── Loading overlay ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(255,248,240,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div className="animate-bounce-slow text-5xl">⭐</div>
        <div className="text-[14px] font-bold text-orange-400">正在加载中…</div>
      </div>
    )
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  if (showParamsDialog) {
    const totalRequired = [
      ...(problemSets[selectedLesson]?.lesson ?? []),
      ...(problemSets[selectedLesson]?.homework ?? []),
      ...(problemSets[selectedLesson]?.workbook.slice(0, 6) ?? []),
      ...(problemSets[selectedLesson]?.pretest ?? []),
    ].length
    const days = Math.ceil(totalRequired / problemsPerDay)
    const isEditing = !!allPlans.find((p) => p.weekStart === selectedWeekStart)

    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: 'rgba(243, 221, 222, 0.45)', backdropFilter: 'blur(4px)' }}
      >
        <div className="mx-auto max-w-130 px-4 py-8">
          {/* Fun header */}
          <div className="mb-6 text-center">
            <div className="mb-2 inline-flex items-center gap-3">
              <span className="animate-wiggle inline-block text-4xl">🚀</span>
              <div>
                <div className="text-[22px] leading-tight font-extrabold text-orange-800">
                  {isEditing ? '修改周计划' : '创建周计划'}
                </div>
              </div>
            </div>
          </div>

          {/* Lesson selector */}
          <div className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-extrabold tracking-widest text-orange-400 uppercase">
                选择本周关卡
              </span>
              <div className="h-px flex-1 bg-orange-100" />
            </div>
            <div className="flex flex-col gap-3">
              {LESSONS.map((l) => {
                const isSelected = selectedLesson === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLesson(l.id)}
                    className="group relative flex cursor-pointer items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200"
                    style={{
                      background: isSelected ? l.bg : 'rgba(255,255,255,.7)',
                      border: `2px solid ${isSelected ? l.border : 'rgba(0,0,0,.06)'}`,
                      boxShadow: isSelected
                        ? `0 4px 20px ${l.color}20`
                        : '0 2px 8px rgba(0,0,0,.04)',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                    }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl transition-transform group-hover:scale-110"
                      style={{ background: l.bg, border: `1.5px solid ${l.border}` }}
                    >
                      {l.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] leading-tight font-extrabold text-gray-800">
                        {l.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">{l.desc}</div>
                    </div>
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold transition-all"
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
            style={{
              background: 'rgba(251,146,60,.08)',
              border: '1.5px dashed rgba(251,146,60,.4)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[14px]">🗺️</span>
              <span className="text-[11px] font-extrabold tracking-wider text-orange-600 uppercase">
                冒险预览
              </span>
            </div>
            <div className="mb-4">
              <div className="mb-2.5 text-[11px] font-extrabold tracking-widest text-gray-400 uppercase">
                每天几道题？
              </div>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setProblemsPerDay(n)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[15px] font-extrabold transition-all hover:scale-105"
                    style={{
                      background:
                        problemsPerDay === n
                          ? 'linear-gradient(135deg, #f97316, #fbbf24)'
                          : 'rgba(0,0,0,.05)',
                      color: problemsPerDay === n ? 'white' : '#9ca3af',
                      boxShadow: problemsPerDay === n ? '0 3px 10px rgba(249,115,22,.4)' : 'none',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[13px] font-medium text-orange-800">
              共 <span className="text-[15px] font-extrabold">{totalRequired}</span> 道必做题
              <span className="mx-1.5 text-orange-300">·</span>
              每天 <span className="text-[15px] font-extrabold">{problemsPerDay}</span> 题
              <span className="mx-1.5 text-orange-300">·</span>约{' '}
              <span className="text-[15px] font-extrabold">{days}</span> 天完成 🎉
            </div>
          </div>

          {/* Settings */}
          <div
            className="mb-6 rounded-xl px-4 py-4"
            style={{ background: 'rgba(255,255,255,.7)', border: '1.5px solid rgba(0,0,0,.06)' }}
          >
            <div>
              <div className="mb-2.5 text-[11px] font-extrabold tracking-widest text-gray-400 uppercase">
                每周从哪天开始？
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeekStartDay(opt.value)}
                    className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-all hover:scale-105"
                    style={{
                      background:
                        weekStartDay === opt.value
                          ? 'linear-gradient(135deg, #f97316, #fbbf24)'
                          : 'rgba(0,0,0,.05)',
                      color: weekStartDay === opt.value ? 'white' : '#9ca3af',
                      boxShadow:
                        weekStartDay === opt.value ? '0 3px 10px rgba(249,115,22,.4)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-5">
                <div className="mt-2.5 mb-2.5 text-[11px] font-extrabold tracking-widest text-gray-400 uppercase">
                  选择周次
                </div>
                <div className="flex flex-col gap-1.5">
                  {weekOptions.map((opt) => {
                    const isSel = selectedWeekStart === opt.value
                    const isCurrent = opt.value === currentWeekStart
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedWeekStart(opt.value)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 text-left transition-all hover:scale-[1.01]"
                        style={{
                          background: isSel
                            ? 'linear-gradient(135deg, rgba(249,115,22,.12), rgba(251,191,36,.12))'
                            : 'rgba(255,255,255,.7)',
                          border: `1.5px solid ${isSel ? '#f97316' : 'rgba(0,0,0,.07)'}`,
                          boxShadow: isSel ? '0 2px 10px rgba(249,115,22,.18)' : 'none',
                        }}
                      >
                        <div
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: isSel ? '#f97316' : 'rgba(0,0,0,.08)',
                          }}
                        >
                          {isSel && <span className="text-[9px] font-extrabold text-white">✓</span>}
                        </div>
                        <span
                          className={`text-[12px] font-bold ${isSel ? 'text-orange-700' : 'text-gray-600'}`}
                        >
                          {opt.label}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-extrabold text-orange-600">
                            本周
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreatePlan}
              className="group relative flex-1 cursor-pointer overflow-hidden rounded-xl py-4 text-[15px] font-extrabold text-white transition-all hover:scale-[1.02] hover:shadow-[0_8px_28px_rgba(249,115,22,.45)] active:scale-[.98]"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="group-hover:animate-wiggle inline-block text-xl">🚀</span>
                {isEditing ? '保存修改' : '创建周计划'}
              </span>
              <div
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)' }}
              />
            </button>
            {weeklyPlan && (
              <button
                type="button"
                onClick={() => setShowParamsDialog(false)}
                className="cursor-pointer rounded-xl px-5 text-[14px] font-bold text-gray-400 transition-all hover:text-gray-600"
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

  const lessonInfo = LESSONS.find((l) => l.id === weeklyPlan.lessonId) ?? LESSONS[0]
  const dayPlan = selectedDate ? weeklyPlan.days.find((d) => d.date === selectedDate) : null
  const dayProgress = weeklyPlan.progress[selectedDate ?? ''] ?? { doneKeys: [] }
  const doneKeys = new Set(dayProgress.doneKeys)

  const todayRequired = dayPlan?.problems ?? []
  const todayDone = todayRequired.filter((p) => doneKeys.has(p.key)).length
  const pct = todayRequired.length > 0 ? Math.round((todayDone / todayRequired.length) * 100) : 0

  return (
    <>
      <div className="mx-auto max-w-160 px-4 py-6">
        {/* Week header */}
        <div
          className="mb-5 rounded-2xl px-5 py-4"
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
                <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                  {fmtWeekRange(weeklyPlan.weekStart, weeklyPlan.weekStartDay)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditDialog}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
                style={{
                  background: 'rgba(255,255,255,.7)',
                  border: '1.5px solid rgba(0,0,0,.08)',
                }}
              >
                换课 ✏️
              </button>
              <button
                type="button"
                onClick={openCreateDialog}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold text-orange-400 transition-all hover:scale-105 hover:text-orange-600"
                style={{
                  background: 'rgba(249,115,22,.08)',
                  border: '1.5px solid rgba(249,115,22,.2)',
                }}
              >
                + 新建
              </button>
            </div>
          </div>
        </div>

        {/* 7-day stepping stones */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-orange-400 uppercase">
            <span>🗺️</span> 本周地图
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weeklyPlan.days.map((day) => {
              const prog = weeklyPlan.progress[day.date] ?? { doneKeys: [] }
              const total = day.problems.length
              const done = prog.doneKeys.filter((k) => day.problems.some((p) => p.key === k)).length
              const isToday = day.date === today
              const isPast = day.date < today
              const isSelected = day.date === selectedDate
              const isComplete = total > 0 && done >= total

              let bg = 'rgba(255,255,255,.7)'
              let border = 'rgba(0,0,0,.08)'
              let textClr = '#9ca3af'
              let shadow = 'none'

              if (isComplete) {
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
              if (isSelected) {
                shadow = `0 4px 16px ${isComplete ? 'rgba(34,197,94,.4)' : isToday ? 'rgba(249,115,22,.4)' : 'rgba(0,0,0,.12)'}`
              }

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className="flex cursor-pointer flex-col items-center rounded-[14px] px-1 py-2.5 text-center transition-all duration-200 hover:scale-105"
                  style={{
                    background: bg,
                    border: `2px solid ${border}`,
                    boxShadow: shadow,
                    transform: isSelected ? 'scale(1.08)' : undefined,
                  }}
                >
                  <div className="mb-0.5 text-[9px] font-bold" style={{ color: textClr }}>
                    {dayLabel(day.date)}
                  </div>
                  <div className="text-[14px] font-extrabold" style={{ color: textClr }}>
                    {fmtDate(day.date).split('/')[1]}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold" style={{ color: textClr }}>
                    {isComplete ? '⭐' : total > 0 ? `${done}/${total}` : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Today shortcut */}
        {selectedDate !== today && weeklyPlan.days.some((d) => d.date === today) && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="mb-4 cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all hover:scale-105"
            style={{
              background: 'rgba(249,115,22,.1)',
              color: '#ea580c',
              border: '1.5px solid rgba(249,115,22,.25)',
            }}
          >
            📍 跳到今天
          </button>
        )}

        {/* Day detail */}
        {dayPlan && (
          <div className="space-y-5">
            {/* Day section header */}
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-extrabold tracking-widest text-gray-400 uppercase">
                {dayLabel(selectedDate!)} · {fmtDate(selectedDate!)}
              </span>
              <div className="h-px flex-1 bg-black/6" />
            </div>

            {/* Progress bar */}
            {todayRequired.length > 0 && (
              <div
                className="rounded-xl px-4 py-4"
                style={{
                  background: 'rgba(255,255,255,.8)',
                  border: '1.5px solid rgba(0,0,0,.06)',
                  boxShadow: '0 2px 12px rgba(0,0,0,.04)',
                }}
              >
                {justCompleted ? (
                  <div className="flex items-center justify-center gap-3 py-1">
                    <span className="animate-star-pop inline-block text-2xl">🎉</span>
                    <div>
                      <div className="text-[15px] font-extrabold text-green-600">
                        今天全部完成啦！
                      </div>
                      <div className="text-[12px] font-medium text-green-500">
                        你真棒！明天继续加油 ⭐
                      </div>
                    </div>
                    <span
                      className="animate-star-pop inline-block text-2xl"
                      style={{ animationDelay: '.15s' }}
                    >
                      ⭐
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[12px] font-extrabold text-gray-500">今日进度</div>
                      <div
                        className="text-[13px] font-extrabold"
                        style={{ color: pct === 100 ? '#16a34a' : '#f97316' }}
                      >
                        {todayDone}/{todayRequired.length} 题
                      </div>
                    </div>
                    <div
                      className="relative h-4 w-full overflow-hidden rounded-full"
                      style={{ background: 'rgba(0,0,0,.06)' }}
                    >
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
                      <div className="mt-1.5 text-[11px] font-medium text-orange-400">
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
                  {dayPlan.problems.map((prob) => (
                    <ProblemCard
                      key={prob.key}
                      prob={prob}
                      done={doneKeys.has(prob.key)}
                      onCheck={
                        doneKeys.has(prob.key)
                          ? undefined
                          : () => handleCheckProblem(selectedDate!, prob.key)
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyDay />
              )}
            </div>

            {/* Review problems */}
            {weeklyPlan?.lessonId === '36'
              ? rotatingReviews.length > 0 && (
                  <div>
                    <SectionHeader
                      icon="🔄"
                      label="知识点复习"
                      count={rotatingReviews.length}
                      accent="#f59e0b"
                    />
                    <div className="space-y-2.5">
                      {rotatingReviews.map((prob) => (
                        <ProblemCard
                          key={prob.key}
                          prob={prob}
                          done={isCompletedToday(prob.key)}
                          isReview
                        />
                      ))}
                    </div>
                  </div>
                )
              : (reviewKeys[selectedDate!]?.length ?? 0) > 0 && (
                  <div>
                    <SectionHeader
                      icon="🔄"
                      label="旧讲复习"
                      count={reviewKeys[selectedDate!].length}
                      accent="#f59e0b"
                    />
                    <div className="space-y-2.5">
                      {reviewKeys[selectedDate!].map((key) => {
                        const found = allProblemMap[key]
                        if (!found) return null
                        return (
                          <ProblemCard key={key} prob={found} done={doneKeys.has(key)} isReview />
                        )
                      })}
                    </div>
                  </div>
                )}

            {/* Weekly lesson review */}
            {weeklyLessonProblem && !weeklyLessonIsSkipped && (
              <WeeklyLessonSection
                problem={weeklyLessonProblem}
                lessonId={weeklyLessonId!}
                reviewCount={weeklyLessonReviewCounts[weeklyLessonProblem.key] ?? 0}
                coveredCount={
                  (priorLessonProbs[weeklyLessonId!] ?? []).filter(
                    (p) => (weeklyLessonReviewCounts[p.key] ?? 0) > 0,
                  ).length
                }
                totalCount={(priorLessonProbs[weeklyLessonId!] ?? []).length}
                isDone={weeklyLessonIsDone}
                onSkip={markWeeklyLessonSkipped}
              />
            )}

            {/* Optional problems */}
            {dayPlan.optionalProblems.length > 0 && (
              <OptionalSection
                problems={dayPlan.optionalProblems}
                doneKeys={doneKeys}
                onCheck={(key) => handleCheckProblem(selectedDate!, key)}
              />
            )}

          </div>
        )}

        {/* Plan history – always visible */}
        {allPlans.length > 0 && (
          <div className="mt-6">
            <AllPlansList
              plans={allPlans}
              currentWeekStart={currentWeekStart ?? ''}
              onDelete={deletePlan}
              onEdit={(plan) => {
                setSelectedLesson(plan.lessonId)
                setWeekStartDay(plan.weekStartDay)
                setProblemsPerDay(plan.problemsPerDay)
                setSelectedWeekStart(plan.weekStart)
                setShowParamsDialog(true)
              }}
            />
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

function SectionHeader({
  icon,
  label,
  count,
  accent = '#6b7280',
}: {
  icon: string
  label: string
  count: number
  accent?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span
        className="text-[12px] font-extrabold tracking-wider uppercase"
        style={{ color: accent }}
      >
        {label}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
        style={{ background: `${accent}15`, color: accent }}
      >
        {count} 题
      </span>
      <div className="h-px flex-1" style={{ background: `${accent}20` }} />
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
      <div className="text-[12px] font-medium text-gray-400">今天没有安排，好好休息！</div>
    </div>
  )
}

function ProblemCard({
  prob,
  done,
  isReview,
  onCheck,
}: {
  prob: MathPlanProblem
  done: boolean
  isReview?: boolean
  onCheck?: () => void
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
      {/* Done indicator / clickable checkbox */}
      <button
        type="button"
        onClick={onCheck}
        disabled={done || !onCheck}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          background: done ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(0,0,0,.05)',
          border: done ? 'none' : '2px solid rgba(0,0,0,.1)',
          boxShadow: done ? '0 2px 8px rgba(34,197,94,.4)' : 'none',
          cursor: done ? 'default' : onCheck ? 'pointer' : 'default',
        }}
      >
        {done && <span className="text-[14px] font-extrabold text-white">✓</span>}
      </button>

      {/* Section badge */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[14px]"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        {SECTION_EMOJI[prob.section] ?? '📋'}
      </div>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] leading-snug font-bold ${done ? 'text-green-600 line-through opacity-70' : 'text-gray-800'}`}
        >
          {prob.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
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
          className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(249,115,22,.4)]"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          做题 ✨
        </Link>
      )}
      {done && <span className="animate-star-pop inline-block shrink-0 text-[20px]">⭐</span>}
    </div>
  )
}

function WeeklyLessonSection({
  problem,
  lessonId,
  reviewCount,
  coveredCount,
  totalCount,
  isDone,
  onSkip,
}: {
  problem: MathPlanProblem
  lessonId: string
  reviewCount: number
  coveredCount: number
  totalCount: number
  isDone: boolean
  onSkip: () => void
}) {
  const sc = SECTION_COLOR[problem.section] ?? SECTION_COLOR.lesson

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">📅</span>
        <span
          className="text-[12px] font-extrabold tracking-wider uppercase"
          style={{ color: '#7c3aed' }}
        >
          本周旧讲
        </span>
        <span className="text-[11px] font-bold text-purple-500">第{lessonId}讲</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
          style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed' }}
        >
          已覆盖 {coveredCount}/{totalCount} 题
        </span>
        <div className="h-px flex-1" style={{ background: 'rgba(124,58,237,.15)' }} />
      </div>

      <div
        className="flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all duration-300"
        style={{
          background: isDone ? 'rgba(220,252,231,.6)' : 'rgba(255,255,255,.85)',
          border: `1.5px solid ${isDone ? '#86efac' : 'rgba(124,58,237,.2)'}`,
          boxShadow: isDone ? 'none' : '0 2px 10px rgba(124,58,237,.06)',
        }}
      >
        {/* Done indicator */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isDone ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(0,0,0,.05)',
            border: isDone ? 'none' : '2px solid rgba(0,0,0,.1)',
            boxShadow: isDone ? '0 2px 8px rgba(34,197,94,.4)' : 'none',
          }}
        >
          {isDone && <span className="text-[14px] font-extrabold text-white">✓</span>}
        </div>

        {/* Section badge */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[14px]"
          style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
        >
          {SECTION_EMOJI[problem.section] ?? '📋'}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <div
            className={`text-[13px] leading-snug font-bold ${isDone ? 'text-green-600 line-through opacity-70' : 'text-gray-800'}`}
          >
            {problem.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] font-medium" style={{ color: sc.text }}>
              第{problem.lessonId}讲
            </span>
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed' }}
            >
              旧讲
            </span>
            {reviewCount > 0 && (
              <span
                className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
                style={{ background: 'rgba(0,0,0,.06)', color: '#9ca3af' }}
              >
                ×{reviewCount}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isDone ? (
          <span className="animate-star-pop inline-block shrink-0 text-[20px]">⭐</span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/math/ny/${problem.lessonId}/${problem.section}/${problem.index}`}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(124,58,237,.4)]"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              做题 ✨
            </Link>
            <button
              type="button"
              onClick={onSkip}
              className="cursor-pointer rounded-md px-2.5 py-2 text-[11px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
              style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)' }}
            >
              跳过
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function OptionalSection({
  problems,
  doneKeys,
  onCheck,
}: {
  problems: MathPlanProblem[]
  doneKeys: Set<string>
  onCheck?: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const doneCount = problems.filter((p) => doneKeys.has(p.key)).length

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-black/3"
        style={{ border: '1.5px dashed rgba(0,0,0,.1)' }}
      >
        <span className="text-base">🌟</span>
        <span className="text-[12px] font-extrabold tracking-wider text-gray-400 uppercase">
          选做题 · {problems.length} 题
        </span>
        {doneCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-extrabold text-yellow-700">
            已做 {doneCount}
          </span>
        )}
        <span
          className="ml-auto text-[12px] text-gray-300 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          {problems.map((prob) => (
            <ProblemCard
              key={prob.key}
              prob={prob}
              done={doneKeys.has(prob.key)}
              onCheck={doneKeys.has(prob.key) ? undefined : () => onCheck?.(prob.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AllPlansList({
  plans,
  currentWeekStart,
  onDelete,
  onEdit,
}: {
  plans: MathWeeklyPlan[]
  currentWeekStart: string
  onDelete: (weekStart: string) => void
  onEdit: (plan: MathWeeklyPlan) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-black/3"
        style={{ border: '1.5px dashed rgba(0,0,0,.08)' }}
      >
        <span className="text-base">📋</span>
        <span className="text-[12px] font-extrabold tracking-wider text-gray-400 uppercase">
          周计划列表 · {plans.length} 个
        </span>
        <span
          className="ml-auto text-[12px] text-gray-300 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {plans.map((plan) => {
            const lessonInfo = LESSONS.find((l) => l.id === plan.lessonId) ?? LESSONS[0]
            const isCurrent = plan.weekStart === currentWeekStart
            const endDate = weekEndDate(plan.weekStart)
            const isPast = endDate < new Date().toISOString().slice(0, 10)
            return (
              <div
                key={plan.weekStart}
                className="flex items-center gap-3 rounded-lg px-3.5 py-3"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, ${lessonInfo.bg}, rgba(255,255,255,.6))`
                    : 'rgba(255,255,255,.7)',
                  border: `1.5px solid ${isCurrent ? lessonInfo.border : 'rgba(0,0,0,.07)'}`,
                  opacity: isPast && !isCurrent ? 0.7 : 1,
                }}
              >
                <span className="shrink-0 text-xl">{lessonInfo.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-gray-700">
                    {lessonInfo.short}
                    {isCurrent && (
                      <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-px text-[9px] font-extrabold text-orange-600">
                        本周
                      </span>
                    )}
                    {isPast && !isCurrent && (
                      <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-bold text-gray-400">
                        已过期
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {fmtDate(plan.weekStart)} — {fmtDate(endDate)}
                    <span className="mx-1 text-gray-300">·</span>
                    截止 {fmtDate(endDate)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(plan)}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
                  style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.07)' }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(plan.weekStart)}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-red-300 transition-all hover:scale-105 hover:text-red-500"
                  style={{
                    background: 'rgba(239,68,68,.06)',
                    border: '1px solid rgba(239,68,68,.15)',
                  }}
                >
                  删除
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
