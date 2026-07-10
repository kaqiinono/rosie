'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { todayStr, useAuth } from '@rosie/core'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { buildDailyTask } from '../../utils/adaptivePlanScheduler'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'

function scopeLabel(plan: AdaptiveWordPlan): string {
  const parts: string[] = []
  if (plan.scope.stages && plan.scope.stages.length > 0) {
    parts.push(`词库 ${plan.scope.stages.join('、')}`)
  }
  if (plan.scope.lessonKeys && plan.scope.lessonKeys.length > 0) {
    parts.push(`课程 ${plan.scope.lessonKeys.map((key) => key.replace('::', ' · ')).join('、')}`)
  }
  return parts.join(' / ') || '未限定范围'
}

function progressStats(rows: AdaptivePlanWordProgress[]) {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const total = activeRows.length
  const mastered = activeRows.filter((row) => row.status === 'MASTERED').length
  return { total, mastered }
}

type PlanTodayInfo = {
  newCount: number
  reviewCount: number
  mastered: number
  total: number
}

export default function AdaptivePlanPractice() {
  const router = useRouter()
  const { user } = useAuth()
  const { plans, isLoading, loadProgress } = useAdaptiveWordPlan(user)
  const [todayByPlanId, setTodayByPlanId] = useState<Record<string, PlanTodayInfo>>({})

  const sortedPlans = useMemo(
    () =>
      [...plans]
        .filter((plan) => plan.status === 'active' || plan.status === 'completed')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1
          return b.updatedAt.localeCompare(a.updatedAt)
        }),
    [plans],
  )

  const activePlans = useMemo(
    () => sortedPlans.filter((plan) => plan.status === 'active'),
    [sortedPlans],
  )

  useEffect(() => {
    if (activePlans.length === 0) {
      setTodayByPlanId({})
      return
    }

    let cancelled = false
    const today = todayStr()

    void Promise.all(
      activePlans.map(async (plan) => {
        const rows = await loadProgress(plan.id)
        const stats = progressStats(rows)
        const dailyTask = buildDailyTask(plan, rows, today)
        return [
          plan.id,
          {
            newCount: dailyTask.activateKeys.length,
            reviewCount: dailyTask.reviewKeys.length,
            mastered: stats.mastered,
            total: stats.total,
          } satisfies PlanTodayInfo,
        ] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setTodayByPlanId(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [activePlans, loadProgress])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pb-3">
        <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7 text-sm text-[var(--wm-text-dim)]">
          加载自适应计划…
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-2 pb-3">
      <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="font-fredoka bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] bg-clip-text text-2xl text-transparent">
            自适应计划
          </div>
        </div>

        {sortedPlans.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--wm-text-dim)]">
            <div className="flex flex-col items-center gap-3">
              <span>暂无自适应计划</span>
              <span className="text-[.75rem]">请家长在管理后台创建英语自适应计划</span>
              <Link
                href="/admin/plans/english"
                className="font-nunito rounded-[10px] border border-[rgba(139,92,246,.4)] bg-[rgba(139,92,246,.08)] px-4 py-2 text-[.8rem] font-extrabold text-[#c4b5fd] no-underline"
              >
                前往计划管理
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedPlans.map((plan) => {
              const todayInfo = todayByPlanId[plan.id]
              return (
                <div
                  key={plan.id}
                  className="group flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)] sm:flex-row sm:items-stretch"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/english/words/adaptive/${plan.id}`)}
                    className="min-h-0 min-w-0 flex-1 cursor-pointer rounded-t-[14px] px-3 py-3 text-left sm:rounded-l-[14px] sm:rounded-tr-none sm:px-5 sm:py-4"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[1rem] font-bold text-[var(--wm-text)]">
                      {plan.title}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[.62rem] font-extrabold ${
                          plan.status === 'completed'
                            ? 'border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] text-[#86efac]'
                            : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.1)] text-[#93c5fd]'
                        }`}
                      >
                        {plan.status === 'completed' ? '已完成' : '进行中'}
                      </span>
                    </div>
                    <div className="mb-1 text-[.74rem] font-bold text-[#c4b5fd]">
                      {scopeLabel(plan)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                      <span>每日新词 {plan.newWordsPerDay}</span>
                      <span>复习上限 {plan.reviewCap}</span>
                      {plan.status === 'active' && todayInfo && (
                        <>
                          <span>
                            已掌握 {todayInfo.mastered}/{todayInfo.total}
                          </span>
                          <span>
                            今日新学 {todayInfo.newCount} · 复习 {todayInfo.reviewCount}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                  <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 px-3 pt-1 pb-3 sm:flex-none sm:flex-nowrap sm:gap-2 sm:self-center sm:px-4 sm:py-4 sm:pt-4 sm:pl-0">
                    <span className="font-nunito rounded-[10px] border border-[rgba(139,92,246,.35)] bg-[rgba(139,92,246,.1)] px-2.5 py-2.5 text-[.72rem] font-extrabold whitespace-nowrap text-[#c4b5fd] sm:px-3 sm:text-[.75rem]">
                      开始练习 →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
