'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import { todayStr } from '@rosie/core'
import { MATH_PLAN_LESSONS, mathPlanDisplayName } from './math-weekly-plan-shared'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'

export default function MathDailyCard() {
  const { user } = useAuth()
  const { weeklyPlan, activePlans, isLoading, allPlans } = useMathWeeklyPlan(user)

  const today = todayStr()
  const todayAssignments = activePlans.flatMap((plan) => {
    const day = plan.days.find((candidate) => candidate.date === today)
    return (day?.problems ?? []).map((problem) => ({ problem, plan }))
  })
  const total = todayAssignments.length
  const done = todayAssignments.filter(({ problem, plan }) =>
    isPlanProblemDone(problem, today, plan.progress[today]?.doneKeys ?? []),
  ).length
  const overdueCount = allPlans.reduce((count, plan) => count + plan.days.reduce((dayCount, day) => {
    if (day.date >= today) return dayCount
    const deferred = new Set((plan.deferredBatches ?? []).flatMap((batch) => batch.sourceAssignmentIds))
    return dayCount + day.problems.filter((problem) =>
      !deferred.has(problem.assignmentId ?? `${day.date}::${problem.key}`) &&
      !isPlanProblemDone(problem, day.date, plan.progress[day.date]?.doneKeys ?? []),
    ).length
  }, 0), 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done >= total
  const lessonInfo = weeklyPlan
    ? (MATH_PLAN_LESSONS.find((l) => l.id === weeklyPlan.lessonId) ?? MATH_PLAN_LESSONS[0])
    : null
  const displayName = weeklyPlan ? mathPlanDisplayName(weeklyPlan) : null

  return (
    <Link
      href="/math/ny/plan"
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(251,146,60,.25)]"
      style={{
        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fce7f3 100%)',
        border: '2px solid rgba(251,146,60,.3)',
        boxShadow: '0 4px 20px rgba(251,146,60,.12)',
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-orange-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-yellow-300/25 blur-xl" />
      <div className="pointer-events-none absolute right-12 bottom-2 h-10 w-10 rounded-full bg-pink-300/20 blur-lg" />

      <div className="relative px-5 py-4">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="animate-wiggle inline-block text-xl">⭐</span>
            <span className="shrink-0 text-[14px] font-extrabold tracking-tight text-orange-800">
              周计划
            </span>
            {displayName && (
              <span className="truncate rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                {lessonInfo?.emoji ? `${lessonInfo.emoji} ` : ''}{displayName}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-orange-500 transition-transform group-hover:translate-x-0.5">
            {(() => {
              if (isLoading) return '…'
              if (!weeklyPlan) return overdueCount > 0 ? `欠 ${overdueCount} 题` : '暂无计划'
              return allDone ? '✅ 完成！' : activePlans.length > 1 ? `${activePlans.length} 个计划` : '去做题'
            })()}
            <span className="text-[14px]">→</span>
          </div>
        </div>

        {isLoading ? (
          <div className="h-2 w-full animate-pulse rounded-full bg-orange-100" />
        ) : weeklyPlan && total > 0 ? (
          <>
            {/* Progress bar */}
            <div className="mb-2 flex items-center gap-2">
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-orange-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: allDone
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : 'linear-gradient(90deg, #f97316, #fbbf24)',
                  }}
                />
                {/* Shimmer on incomplete */}
                {!allDone && pct > 5 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full opacity-50"
                    style={{
                      width: `${pct}%`,
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.6) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite',
                    }}
                  />
                )}
              </div>
              <span
                className={`shrink-0 text-[12px] font-extrabold ${allDone ? 'text-green-600' : 'text-orange-600'}`}
              >
                {done}/{total}
              </span>
            </div>

            {/* Today's problems preview */}
            <div className="flex flex-wrap gap-1.5">
              {todayAssignments.slice(0, 4).map(({ problem: p, plan }, i) => {
                const isDone = isPlanProblemDone(p, today, plan.progress[today]?.doneKeys ?? [])
                return (
                  <span
                    key={`${plan.weekStart}::${p.assignmentId ?? p.key}`}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                      isDone
                        ? 'bg-green-100 text-green-700 line-through opacity-70'
                        : 'border border-orange-200 bg-white/80 text-orange-700'
                    }`}
                  >
                    {isDone ? '⭐' : `${i + 1}.`} {p.isDeferred ? '延期 · ' : ''}{p.title.split('·')[0].trim()}
                  </span>
                )
              })}
              {total > 4 && (
                <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-400">
                  +{total - 4} 题
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[12px] font-medium text-orange-700/70">
            还没有进行中的计划，请家长在计划中心创建
          </div>
        )}
      </div>
    </Link>
  )
}
