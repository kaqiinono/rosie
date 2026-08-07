'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import { useProblemMastery } from '@rosie/math-kit/hooks/useProblemMastery'
import { useMathSolved } from '@rosie/math-kit/hooks/useMathSolved'
import {
  getMathReviewProblemsForDay,
  makeProblem,
  planEndDate,
  buildProblemIdMap,
  collectOverduePlanProblems,
} from '@rosie/math-kit/utils/math-helpers'
import { useMathRotatingReview } from '@rosie/math-kit/hooks/useMathRotatingReview'
import { useMathWeeklyLessonReview } from '@rosie/math-kit/hooks/useMathWeeklyLessonReview'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import ProblemMasteryPanel from './ProblemMasteryPanel'
import { todayStr } from '@rosie/core'
import { compareLessonIds } from '@rosie/math-kit/utils/lesson-registry'
import type { MathPlanProblem, ProblemSet } from '@rosie/core'
import { useStartPracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/useStartPracticeQueue'
import { usePracticeQueue } from '@rosie/math/components/shared/practice-queue/PracticeQueueContext'
import { useViewableDraftIds } from '@rosie/math-kit/hooks/useViewableDraftIds'
import {
  mathPlanProblemsToQueueItems,
  rehydratePracticeQueueItems,
} from '@rosie/math/utils/practice-queue-from-plan'
import {
  clearMathPendingEverywhere,
  readMathPracticeSnapshot,
  resolveMathPracticeSnapshot,
} from '@rosie/math-kit/utils/practice-queue-snapshot'
import {
  canAutoEnterMathPlanPractice,
  isResumablePlanPracticeSnapshot,
  mathPlanPracticeReturnHref,
  MATH_PLAN_PRACTICE_HREF,
} from '@rosie/math/utils/math-plan-practice-entry'
import {
  MATH_PLAN_LESSONS,
  mathPlanDisplayName,
  fmtDate,
  fmtPlanRange,
  dayLabel,
  SectionHeader,
  EmptyDay,
  ProblemCard,
  WeeklyLessonSection,
  OptionalSection,
} from './math-weekly-plan-shared'
import MathPlanMap, { type MapMode } from './MathPlanMap'

const OVERDUE_PAGE_SIZE = 5

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  problemSets: Record<string, ProblemSet>
  /** Practice route (`/math/ny/plan/practice`): jump into today's first unfinished problem. */
  autoStart?: boolean
}

export default function MathWeeklyPlanSession({ problemSets, autoStart = false }: Props) {
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
  const startPractice = useStartPracticeQueue()
  const { resume, isActive: practiceActive } = usePracticeQueue()

  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('week')
  const autoStartDoneRef = useRef(false)
  /** Resume lookup finished (success, empty, or skipped). Auto-start must wait on this. */
  const [resumeChecked, setResumeChecked] = useState(false)
  const [overduePage, setOverduePage] = useState(0)

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

  // Session pool for celebration "继续练习". Ref so the checker always reads
  // the latest solveCount (rebuilt every render below).
  const remainingPoolRef = useRef<{
    pool: MathPlanProblem[]
    title: string
    preserveOrder: boolean
  } | null>(null)
  const remainingCheckerRef = useRef<(() => { count: number; onStart: () => void } | null) | null>(null)

  const beginPractice = useCallback(
    (
      pool: MathPlanProblem[],
      initialProblemId: string,
      title = '每日一练',
      preserveOrder = false,
      checkRemaining?: boolean,
    ): boolean => {
      const items = mathPlanProblemsToQueueItems(pool, problemSets)
      if (items.length === 0 || !user) return false
      if (checkRemaining) {
        remainingPoolRef.current = { pool, title, preserveOrder }
      }
      startPractice({
        pool: items,
        source: 'plan',
        title,
        initialProblemId,
        preserveOrder,
        checkRemaining: checkRemaining
          ? () => remainingCheckerRef.current?.() ?? null
          : undefined,
        returnHref: mathPlanPracticeReturnHref(),
      })
      return true
    },
    [problemSets, startPractice, user],
  )

  // Resume / auto-start only on `/math/ny/plan/practice` (autoStart).
  // Hub `/math/ny/plan` must stay on the overview — mid-exit returnHref lands here,
  // and resuming would immediately drop the child back into practice.
  const userId = user?.id
  useEffect(() => {
    if (!canAutoEnterMathPlanPractice(autoStart)) {
      setResumeChecked(true)
      return
    }
    if (practiceActive) {
      setResumeChecked(true)
      return
    }
    if (isLoading || resumeChecked || !weeklyPlan) return

    let cancelled = false

    const todayProblemIds = (
      weeklyPlan.days.find((d) => d.date === today)?.problems ?? []
    ).map((p) => p.problemId)

    const tryResume = (pending: NonNullable<ReturnType<typeof readMathPracticeSnapshot>>) => {
      if (!isResumablePlanPracticeSnapshot(pending, todayProblemIds, today)) {
        void clearMathPendingEverywhere(userId, 'plan')
        return false
      }
      const items = rehydratePracticeQueueItems(pending.items, problemSets)
      if (items.length === 0) {
        void clearMathPendingEverywhere(userId, 'plan')
        return false
      }
      if (!userId) return false

      // Resume is always today's plan session — pin the checker pool to today
      // (not selectedDate). Fresh solveCount comes from the every-render rebuild.
      const todayDay = weeklyPlan.days.find((d) => d.date === today)
      if (todayDay && todayDay.problems.length > 0) {
        remainingPoolRef.current = {
          pool: todayDay.problems,
          title: pending.title || '每日一练',
          preserveOrder: false,
        }
      }

      resume({
        items,
        currentIndex: Math.min(pending.currentIndex, items.length - 1),
        sessionCorrect: pending.sessionCorrect,
        phase: pending.phase,
        source: 'plan',
        returnHref: mathPlanPracticeReturnHref(),
        title: pending.title || '每日一练',
        immersive: pending.immersive,
        checkRemaining: () => remainingCheckerRef.current?.() ?? null,
      })
      return true
    }

    const local = readMathPracticeSnapshot('plan')

    if (!userId) {
      // The portal needs auth. Wait for it if there's something to resume.
      if (local && isResumablePlanPracticeSnapshot(local, todayProblemIds, today)) return
      setResumeChecked(true)
      return
    }

    let timer: number | undefined

    void (async () => {
      // Always go through resolve so pickBestPending can prefer a newer revision
      // from another device; the sync local read is only the timeout fallback.
      const pending = await Promise.race([
        resolveMathPracticeSnapshot(userId, 'plan'),
        new Promise<null>((resolve) => {
          timer = window.setTimeout(() => resolve(null), 2000)
        }),
      ])
      if (timer !== undefined) window.clearTimeout(timer)
      if (cancelled) return
      const winner = pending ?? local
      // Scope `queue:plan` only — and only if it is still today's required set.
      if (winner) tryResume(winner)
      setResumeChecked(true)
    })()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [autoStart, practiceActive, isLoading, resumeChecked, userId, problemSets, resume, weeklyPlan, today])

  // Practice route: jump straight into today's first unfinished required problem.
  useEffect(() => {
    if (
      !canAutoEnterMathPlanPractice(autoStart) ||
      autoStartDoneRef.current ||
      !resumeChecked ||
      isLoading ||
      !weeklyPlan
    ) {
      return
    }
    if (practiceActive) {
      autoStartDoneRef.current = true
      return
    }
    // start() / resume() no-op without auth — retry when user is ready.
    if (!user) return

    // 「执行计划」always means today's required queue, not the calendar selection.
    const dayPlan = weeklyPlan.days.find((d) => d.date === today)
    if (!dayPlan || dayPlan.problems.length === 0) {
      autoStartDoneRef.current = true
      return
    }
    const doneKeys = new Set((weeklyPlan.progress[today] ?? { doneKeys: [] }).doneKeys)
    const firstUndone = dayPlan.problems.find((p) => !doneKeys.has(p.key))
    // All required problems done — stay on the plan page; do not re-enter practice.
    if (!firstUndone) {
      autoStartDoneRef.current = true
      return
    }

    const started = beginPractice(dayPlan.problems, firstUndone.problemId, '每日一练', false, true)
    if (!started) return
    autoStartDoneRef.current = true
  }, [
    autoStart,
    resumeChecked,
    isLoading,
    weeklyPlan,
    today,
    beginPractice,
    practiceActive,
    user,
  ])

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

  // One batched draft-presence load for the selected day (avoids N per-card fetches).
  // Must stay above early returns (Rules of Hooks).
  const dayDraftProblemIds = useMemo(() => {
    if (!weeklyPlan || !selectedDate) return [] as string[]
    const day = weeklyPlan.days.find((d) => d.date === selectedDate)
    if (!day) return [] as string[]
    const ids: string[] = [
      ...day.problems.map((p) => p.problemId),
      ...day.optionalProblems.map((p) => p.problemId),
      ...(wrongByDay[selectedDate] ?? []).map((p) => p.problemId),
      ...rotatingReviews.map((p) => p.problemId),
    ]
    for (const key of reviewKeys[selectedDate] ?? []) {
      const found = allProblemMap[key]
      if (found) ids.push(found.problemId)
    }
    if (weeklyLessonProblem) ids.push(weeklyLessonProblem.problemId)
    return ids
  }, [
    weeklyPlan,
    selectedDate,
    wrongByDay,
    rotatingReviews,
    reviewKeys,
    allProblemMap,
    weeklyLessonProblem,
  ])

  const [draftRefreshKey, setDraftRefreshKey] = useState(0)
  const wasPracticeActive = useRef(false)
  useEffect(() => {
    if (wasPracticeActive.current && !practiceActive) {
      setDraftRefreshKey((k) => k + 1)
    }
    wasPracticeActive.current = practiceActive
  }, [practiceActive])

  const { draftProblemIds } = useViewableDraftIds(user, dayDraftProblemIds, draftRefreshKey)

  // Problems with at least one solve — treated as done even before plan progress syncs.
  const doneProblemIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, count] of Object.entries(solveCount)) {
      if (count > 0) ids.add(id)
    }
    return ids
  }, [solveCount])

  const overdueItems = useMemo(
    () => (weeklyPlan ? collectOverduePlanProblems(weeklyPlan, today) : []),
    [weeklyPlan, today],
  )
  // Exclude already-solved problems so 补做 always starts from the first undone question.
  const overdueUndoneItems = useMemo(
    () => overdueItems.filter(({ problem }) => !doneProblemIds.has(problem.problemId)),
    [overdueItems, doneProblemIds],
  )
  const overduePool = useMemo(() => overdueUndoneItems.map((item) => item.problem), [overdueUndoneItems])

  // Reset overdue page when list shrinks
  const overdueTotalPages = Math.max(1, Math.ceil(overdueUndoneItems.length / OVERDUE_PAGE_SIZE))
  useEffect(() => {
    if (overduePage >= overdueTotalPages) setOverduePage(0)
  }, [overdueTotalPages, overduePage])
  const overduePageItems = useMemo(
    () => overdueUndoneItems.slice(overduePage * OVERDUE_PAGE_SIZE, (overduePage + 1) * OVERDUE_PAGE_SIZE),
    [overdueUndoneItems, overduePage],
  )

  // Always-fresh checker: pool comes from beginPractice / resume; solveCount
  // from this render so celebration never sees a stale closure.
  remainingCheckerRef.current = (() => {
    const cfg = remainingPoolRef.current
    if (!cfg || cfg.pool.length === 0) return null
    const remaining = cfg.pool.filter((p) => (solveCount[p.problemId] ?? 0) === 0)
    if (remaining.length === 0) return null
    return {
      count: remaining.length,
      onStart: () => {
        const first = remaining[0]
        if (first) {
          beginPractice(remaining, first.problemId, cfg.title, cfg.preserveOrder, true)
        }
      },
    }
  })

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
        <div className="mx-auto w-full px-4 py-6 md:px-6">
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
            <ProblemMasteryPanel
              problems={allPlanProblems}
              masteryMap={masteryMap}
              problemSets={problemSets}
            />
          </div>
        )}
      </>
    )
  }

  // ── Week View ───────────────────────────────────────────────────────────────
  const planLessonIds = activePlanLessonIds
  const lessonInfo = MATH_PLAN_LESSONS.find(l => l.id === weeklyPlan.lessonId) ?? MATH_PLAN_LESSONS[0]
  const headerTitle = mathPlanDisplayName(weeklyPlan)
  const headerEmoji = planLessonIds.length === 1 ? lessonInfo.emoji : '📚'
  const dayPlan = selectedDate ? weeklyPlan.days.find((d) => d.date === selectedDate) : null
  const dayProgress = weeklyPlan.progress[selectedDate ?? ''] ?? { doneKeys: [] }
  const doneKeys = new Set(dayProgress.doneKeys)

  const todayRequired = dayPlan?.problems ?? []
  const todayDone = todayRequired.filter((p) => doneKeys.has(p.key)).length
  const pct = todayRequired.length > 0 ? Math.round((todayDone / todayRequired.length) * 100) : 0

  return (
    <>
      <div className="mx-auto w-full px-4 py-6 md:px-6">
        {/* Week header */}
        <div
          className="mb-5 rounded-2xl px-5 py-4"
          style={{
            background: `linear-gradient(135deg, ${lessonInfo.bg}, rgba(255,255,255,.5))`,
            border: `2px solid ${lessonInfo.border}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-3xl">{headerEmoji}</span>
              <div className="min-w-0">
                <div className="truncate text-[16px] font-extrabold text-gray-800">{headerTitle}</div>
                <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                  {fmtPlanRange(weeklyPlan.weekStart, planEndDate(weeklyPlan))}
                  <span className="mx-1 text-gray-300">·</span>
                  每天约 {weeklyPlan.problemsPerDay} 题
                </div>
              </div>
            </div>
            {!autoStart && (
              <Link
                href={MATH_PLAN_PRACTICE_HREF}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white no-underline transition-all hover:scale-105 sm:px-4 sm:text-[13px]"
                style={{
                  background: 'linear-gradient(135deg, #ea580c, #f59e0b)',
                  boxShadow: '0 2px 10px rgba(234,88,12,.35)',
                }}
              >
                执行计划
              </Link>
            )}
          </div>
        </div>

        {/* Plan map: week (Mon–Sun) / month calendar */}
        <MathPlanMap
          plan={weeklyPlan}
          problemSets={problemSets}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          today={today}
          mode={mapMode}
          onModeChange={setMapMode}
          onPracticeProblem={(prob, dayProblems) => {
            beginPractice(dayProblems, prob.problemId, '每日一练', false, true)
          }}
        />

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

        {/* Plan-scoped overdue make-up — independent of selected day / calendar mode */}
        {overdueUndoneItems.length > 0 && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeader icon="⏰" label="待补做" count={overdueUndoneItems.length} accent="#ef4444" />
              <button
                type="button"
                onClick={() => {
                  const first = overduePool[0]
                  if (first) beginPractice(overduePool, first.problemId, '待补做', true, true)
                }}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #f97316)',
                  boxShadow: '0 2px 10px rgba(239,68,68,.3)',
                }}
              >
                一键补做
              </button>
            </div>
            <p className="px-1 text-[12px] font-medium text-gray-500">
              过去日期尚未完成的必做题；做完后进度仍记回原来的那天。
            </p>
            <div className="space-y-2.5">
              {overduePageItems.map(({ date, problem }) => (
                <ProblemCard
                  key={`${date}::${problem.key}`}
                  prob={problem}
                  done={false}
                  isWrong={wrongIds.has(problem.problemId)}
                  overdueDate={date}
                  problemSets={problemSets}
                  hasDraft={draftProblemIds.has(problem.problemId)}
                  onPractice={() => beginPractice(overduePool, problem.problemId, '待补做', true, true)}
                />
              ))}
            </div>
            {overdueTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={overduePage === 0}
                  onClick={() => setOverduePage((p) => Math.max(0, p - 1))}
                  className="cursor-pointer rounded-full border-0 px-3 py-1 text-[12px] font-bold transition-all disabled:cursor-default disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444' }}
                >
                  ← 上一页
                </button>
                <span className="text-[12px] font-bold text-gray-400">
                  {overduePage + 1} / {overdueTotalPages}
                </span>
                <button
                  type="button"
                  disabled={overduePage >= overdueTotalPages - 1}
                  onClick={() => setOverduePage((p) => Math.min(overdueTotalPages - 1, p + 1))}
                  className="cursor-pointer rounded-full border-0 px-3 py-1 text-[12px] font-bold transition-all disabled:cursor-default disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444' }}
                >
                  下一页 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Day detail — month mode shows required list inside the calendar */}
        {dayPlan && (
          <div className="space-y-5">
            {mapMode === 'week' && (
              <>
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
                          overdueDate={
                            selectedDate && selectedDate < today && !doneKeys.has(prob.key)
                              ? selectedDate
                              : undefined
                          }
                          problemSets={problemSets}
                          hasDraft={draftProblemIds.has(prob.problemId)}
                          onPractice={
                            doneKeys.has(prob.key)
                              ? undefined
                              : () => beginPractice(dayPlan.problems, prob.problemId, '每日一练', false, true)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyDay />
                  )}
                </div>
              </>
            )}

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
                          problemSets={problemSets}
                          hasDraft={draftProblemIds.has(prob.problemId)}
                          onPractice={
                            wrongIds.has(prob.problemId)
                              ? () => beginPractice(extraWrong, prob.problemId, '错题巩固')
                              : undefined
                          }
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
                          problemSets={problemSets}
                          hasDraft={draftProblemIds.has(prob.problemId)}
                          onPractice={
                            isCompletedToday(prob.key)
                              ? undefined
                              : () => beginPractice(rotatingReviews, prob.problemId, '知识点复习')
                          }
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
                        const reviewPool = reviewKeys[selectedDate!]
                          .map((k) => allProblemMap[k])
                          .filter((p): p is MathPlanProblem => p != null)
                        return (
                          <ProblemCard
                            key={key}
                            prob={found}
                            done={doneKeys.has(key)}
                            isReview
                            problemSets={problemSets}
                            hasDraft={draftProblemIds.has(found.problemId)}
                            onPractice={
                              doneKeys.has(key)
                                ? undefined
                                : () => beginPractice(reviewPool, found.problemId, '旧讲复习')
                            }
                          />
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
                problemSets={problemSets}
                hasDraft={draftProblemIds.has(weeklyLessonProblem.problemId)}
                onPractice={
                  weeklyLessonIsDone
                    ? undefined
                    : () =>
                        beginPractice(
                          [weeklyLessonProblem],
                          weeklyLessonProblem.problemId,
                          '本周旧讲',
                        )
                }
              />
            )}

            {/* Optional problems */}
            {dayPlan.optionalProblems.length > 0 && (
              <OptionalSection
                problems={dayPlan.optionalProblems}
                doneKeys={doneKeys}
                problemSets={problemSets}
                draftProblemIds={draftProblemIds}
                onPractice={(prob) =>
                  beginPractice(dayPlan.optionalProblems, prob.problemId, '选做题')
                }
              />
            )}

          </div>
        )}

        {/* Mastery panel — same width as plan content above */}
        {allPlanProblems.length > 0 && (
          <div className="mt-6">
            <ProblemMasteryPanel
              problems={allPlanProblems}
              masteryMap={masteryMap}
              problemSets={problemSets}
            />
          </div>
        )}
      </div>
    </>
  )
}
