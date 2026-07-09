'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { AllPlansList } from './math-weekly-plan-shared'

export default function MathWeeklyPlanManage() {
  const router = useRouter()
  const { user } = useAuth()
  const { allPlans, currentWeekStart, deletePlan, isLoading } = useMathWeeklyPlan(user)

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="animate-bounce-slow text-4xl">📋</div>
        <div className="text-[14px] font-bold text-orange-400">正在加载计划…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-160 px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold text-orange-900">数学计划</h1>
          <p className="mt-1 text-[12px] text-gray-500">创建、修改与删除数学每日一练计划</p>
        </div>
        <Link
          href="/admin/plans/math/new"
          className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white no-underline transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',
            boxShadow: '0 4px 14px rgba(249,115,22,.35)',
          }}
        >
          + 新建计划
        </Link>
      </div>

      {allPlans.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{
            background: 'rgba(255,248,240,0.65)',
            border: '2px dashed rgba(251,146,60,.35)',
          }}
        >
          <div className="mb-2 text-4xl">📅</div>
          <div className="mb-4 text-[14px] font-bold text-orange-800">还没有数学计划</div>
          <Link
            href="/admin/plans/math/new"
            className="inline-block rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-white no-underline"
            style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <AllPlansList
          plans={allPlans}
          currentWeekStart={currentWeekStart ?? ''}
          defaultExpanded
          onDelete={deletePlan}
          onEdit={(plan) => {
            router.push(`/admin/plans/math/${encodeURIComponent(plan.weekStart)}`)
          }}
        />
      )}

      <div className="mt-6 text-center">
        <Link href="/math/ny/plan" className="text-[12px] font-bold text-orange-500 no-underline hover:underline">
          前往做题 →
        </Link>
      </div>
    </div>
  )
}
