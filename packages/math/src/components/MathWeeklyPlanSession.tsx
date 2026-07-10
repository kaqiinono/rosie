'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useProblemMastery } from '@rosie/math/hooks/useProblemMastery'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import {
  getMathReviewProblemsForDay,
  makeProblem,
  planEndDate,
  buildProblemIdMap,
} from '@rosie/math/utils/math-helpers'
import { useMathRotatingReview } from '@rosie/math/hooks/useMathRotatingReview'
import { useMathWeeklyLessonReview } from '@rosie/math/hooks/useMathWeeklyLessonReview'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import ProblemMasteryPanel from './ProblemMasteryPanel'
import { todayStr } from '@rosie/core'
import { compareLessonIds } from '@rosie/math/utils/lesson-registry'
import type { MathPlanProblem, ProblemSet } from '@rosie/core'
import {
  MATH_PLAN_LESSONS,
  fmtDate,
  fmtPlanRange,
  dayLabel,
  SectionHeader,
  EmptyDay,
  ProblemCard,
  WeeklyLessonSection,
  OptionalSection,
} from './math-weekly-plan-shared'

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  problemSets: Record<string, ProblemSet>
}

export default function MathWeeklyPlanSession({ problemSets }: Props) {
  const { user } = useAuth()
  const {
    weeklyPlan,
    allPlans,
    allPriorKeys,
    priorProblemMap,
    addDoneKey,
    isLoading,
  } = useMathWeeklyPlan(user)
  const { masteryMap, recordProblemResult } = useProblemMastery(user)
  const { solveCount } = useMathSolved(user)
  const { wrongIds } = useMathWrong(user)

  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Auto-select date when plan loads (during-render).
  const [autoSelectKey, setAutoSelectKey] = useState('')
  const newSelectKey = `${isLoading}|${weeklyPlan?.weekStart ?? ''}`
  if (autoSelectKey !== newSelectKey) {
    setAutoSelectKey(newSelectKey)
    if (!isLoading && weeklyPlan) {
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

  const handleCheckProblem = useCallback(
    async (date: string, key: string) => {
      await addDoneKey(date, key)
      recordProblemResult(key, true)
    },
    [addDoneKey, recordProblemResult],
  )

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

  const activePlanLessonIds = useMemo(
    () => (weeklyPlan ? (weeklyPlan.lessonIds ?? [weeklyPlan.lessonId]) : []),
    [weeklyPlan],
  )

  const problemIdMap = useMemo(
    () => buildProblemIdMap(problemSets, activePlanLessonIds),
    [problemSets, activePlanLessonIds],
  )

  /** Wrong problems in plan scope, excluding same-day 必做题 to avoid duplicate cards. */
  const wrongByDay = useMemo(() => {
    if (!weeklyPlan) return {} as Record<string, MathPlanProblem[]>
    const result: Record<string, MathPlanProblem[]> = {}
    for (const day of weeklyPlan.days) {
      const requiredIds = new Set(day.problems.map(p => p.problemId))
      result[day.date] = [...wrongIds]
        .map(id => problemIdMap.get(id))
        .filter((p): p is MathPlanProblem => p != null && !requiredIds.has(p.problemId))
        .sort((a, b) => {
          const lc = compareLessonIds(a.lessonId, b.lessonId)
          if (lc !== 0) return lc
          return a.key.localeCompare(b.key)
        })
    }
    return result
  }, [weeklyPlan, wrongIds, problemIdMap])

  // All prior lesson problems (lessonId < current), skipping lessons with no problems (e.g. pure animation)
  const priorLessonProbs = useMemo(() => {
    if (!weeklyPlan) return {} as Record<string, MathPlanProblem[]>
    const result: Record<string, MathPlanProblem[]> = {}
    for (const [id, ps] of Object.entries(problemSets)) {
      if (compareLessonIds(id, weeklyPlan.lessonId) >= 0) continue
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
    weeklyPlan?.problemsPerDay ?? 3,
  )

  // Detect rotating review completions
  useEffect(() => {
    if (weeklyPlan?.lessonId !== '1-36') return
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

  // ── Empty-state View (no current-week plan) ─────────────────────────────────
  if (!weeklyPlan) {
    const today = todayStr()
    const inactivePlans = allPlans.filter(
      (p) => !(p.weekStart <= today && today <= planEndDate(p)),
    )

    return (
      <>
        <div className="mx-auto max-w-160 px-4 py-6">
          <div
            className="mb-5 rounded-2xl px-5 py-10 text-center"
            style={{
              background: 'rgba(255,248,240,0.65)',
              border: '2px dashed rgba(251,146,60,.35)',
            }}
          >
            <div className="mb-3 text-5xl">📅</div>
            <div className="mb-2 text-[16px] font-extrabold text-orange-800">
              {allPlans.length === 0 ? '当前还没有进行中的计划' : '今天没有进行中的计划'}
            </div>
            <div className="mb-5 text-[12px] text-gray-500">
              {allPlans.length === 0
                ? '请家长在管理后台创建数学计划，然后回来做题吧'
                : inactivePlans.length > 0
                  ? `共有 ${allPlans.length} 个计划，但都不覆盖今天（可能已过期或尚未开始）`
                  : '请家长在管理后台检查计划日期'}
            </div>
            <Link
              href="/admin/plans/math"
              className="inline-block rounded-xl px-6 py-3 text-[14px] font-extrabold text-white no-underline transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',
                boxShadow: '0 6px 18px rgba(249,115,22,.4)',
              }}
            >
              {allPlans.length === 0 ? '前往计划管理' : '查看 / 调整计划'}
            </Link>
          </div>

          {inactivePlans.length > 0 && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,.8)', border: '1.5px solid rgba(0,0,0,.06)' }}
            >
              <div className="mb-2 text-[11px] font-extrabold tracking-wide text-gray-400 uppercase">
                已有计划
              </div>
              <ul className="space-y-2">
                {inactivePlans.map((plan) => {
                  const end = planEndDate(plan)
                  const notStarted = today < plan.weekStart
                  const expired = today > end
                  return (
                    <li
                      key={plan.weekStart}
                      className="flex items-center justify-between gap-2 text-[12px] text-gray-600"
                    >
                      <span>
                        {fmtPlanRange(plan.weekStart, end)}
                        <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                          {notStarted ? '未开始' : expired ? '已过期' : '—'}
                        </span>
                      </span>
                      <Link
                        href="/admin/plans/math"
                        className="shrink-0 text-[11px] font-bold text-orange-500 no-underline"
                      >
                        管理 →
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {allPlanProblems.length > 0 && (
          <div className="mt-4">
            <ProblemMasteryPanel problems={allPlanProblems} masteryMap={masteryMap} />
          </div>
        )}
      </>
    )
  }

  // ── Week View ───────────────────────────────────────────────────────────────
  const planLessonIds = activePlanLessonIds
  const lessonInfo = MATH_PLAN_LESSONS.find(l => l.id === weeklyPlan.lessonId) ?? MATH_PLAN_LESSONS[0]
  const headerTitle =
    planLessonIds.length === 1
      ? (MATH_PLAN_LESSONS.find(l => l.id === planLessonIds[0])?.short ?? lessonInfo.short)
      : `${planLessonIds.length} 个关卡`
  const headerEmoji = planLessonIds.length === 1 ? lessonInfo.emoji : '📚'
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
              <span className="text-3xl">{headerEmoji}</span>
              <div>
                <div className="text-[16px] font-extrabold text-gray-800">{headerTitle}</div>
                <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                  {fmtPlanRange(weeklyPlan.weekStart, planEndDate(weeklyPlan))}
                  <span className="mx-1 text-gray-300">·</span>
                  每天约 {weeklyPlan.problemsPerDay} 题
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7-day stepping stones */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-orange-400 uppercase">
            <span>🗺️</span> 计划地图
          </div>
          <div className={weeklyPlan.days.length > 7 ? 'overflow-x-auto pb-1' : ''}>
          <div
            className={`grid gap-1.5 ${weeklyPlan.days.length <= 7 ? 'grid-cols-7' : ''}`}
            style={
              weeklyPlan.days.length > 7
                ? { gridTemplateColumns: `repeat(${weeklyPlan.days.length}, minmax(44px, 1fr))`, minWidth: `${weeklyPlan.days.length * 52}px` }
                : undefined
            }
          >
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
                      isWrong={wrongIds.has(prob.problemId)}
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

            {/* Wrong-answer reinforcement */}
            {(() => {
              const extraWrong = wrongByDay[selectedDate!] ?? []
              const wrongInRequired = dayPlan.problems.filter(p => wrongIds.has(p.problemId)).length
              if (extraWrong.length === 0 && wrongInRequired === 0) return null
              return (
                <div>
                  <SectionHeader
                    icon="📕"
                    label="错题巩固"
                    count={extraWrong.length + wrongInRequired}
                    accent="#ef4444"
                  />
                  {extraWrong.length > 0 ? (
                    <div className="space-y-2.5">
                      {extraWrong.map((prob) => (
                        <ProblemCard
                          key={prob.key}
                          prob={prob}
                          done={!wrongIds.has(prob.problemId)}
                          isWrong
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 text-[12px] leading-relaxed font-medium text-gray-500">
                      今日 {wrongInRequired} 道错题已在必做题中，请优先完成标注「错题」的题目。
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Review problems */}
            {weeklyPlan?.lessonId === '1-36'
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
