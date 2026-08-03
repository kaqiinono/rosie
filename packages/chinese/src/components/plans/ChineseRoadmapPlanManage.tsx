'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@rosie/core'
import { useChineseRoadmapPlan } from '../../hooks/useChineseRoadmapPlan'
import { getChineseBook } from '../../utils/chinese-books'
import type { ChineseRoadmapPlan } from '../../utils/chineseRoadmapPlanTypes'
import {
  formatPlanQuizTypes,
  fmtPlanDateTime,
  planStatusLabel,
} from './chinese-roadmap-plan-shared'

function statusBadgeClass(status: ChineseRoadmapPlan['status']): string {
  switch (status) {
    case 'active':
      return 'border-[rgba(34,197,94,.35)] bg-[rgba(34,197,94,.1)] text-emerald-700'
    case 'paused':
      return 'border-[rgba(148,163,184,.4)] bg-[rgba(148,163,184,.12)] text-slate-600'
    case 'completed':
      return 'border-[rgba(59,130,246,.35)] bg-[rgba(59,130,246,.1)] text-blue-700'
    default:
      return 'border-[rgba(148,163,184,.35)] bg-[rgba(148,163,184,.08)] text-slate-500'
  }
}

export default function ChineseRoadmapPlanManage() {
  const { user } = useAuth()
  const { plans, isLoading, pausePlan, activatePlan, archivePlan } = useChineseRoadmapPlan(user)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const sortedPlans = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const handlePause = async (plan: ChineseRoadmapPlan) => {
    setTogglingId(plan.id)
    try {
      await pausePlan(plan.id)
    } catch (err) {
      console.error('[chinese_roadmap_plan] pause failed', err)
      window.alert('暂停失败，请检查网络后重试。')
    } finally {
      setTogglingId(null)
    }
  }

  const handleActivate = async (plan: ChineseRoadmapPlan) => {
    const hasOtherActive = plans.some((p) => p.status === 'active' && p.id !== plan.id)
    if (
      hasOtherActive &&
      !window.confirm('恢复此计划将暂停当前进行中的计划，确定继续？')
    ) {
      return
    }
    setTogglingId(plan.id)
    try {
      await activatePlan(plan.id)
    } catch (err) {
      console.error('[chinese_roadmap_plan] activate failed', err)
      window.alert('恢复失败，请检查网络后重试。')
    } finally {
      setTogglingId(null)
    }
  }

  const handleArchive = async (plan: ChineseRoadmapPlan) => {
    if (!window.confirm(`确定归档「${plan.title}」？归档后列表中不再显示。`)) return
    setArchivingId(plan.id)
    try {
      await archivePlan(plan.id)
    } catch (err) {
      console.error('[chinese_roadmap_plan] archive failed', err)
      window.alert('归档失败，请检查网络后重试。')
    } finally {
      setArchivingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="animate-bounce text-4xl">📜</div>
        <div className="text-[14px] font-bold text-amber-600">正在加载计划…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold text-amber-900">语文计划</h1>
          <p className="mt-1 text-[12px] text-gray-500">
            按教材路线图推进：控制关卡与题型，暂停 / 恢复
          </p>
        </div>
        <Link
          href="/admin/plans/chinese/new"
          className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white no-underline transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
            boxShadow: '0 4px 14px rgba(217,119,6,.35)',
          }}
        >
          + 创建计划
        </Link>
      </div>

      {sortedPlans.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{
            background: 'rgba(255,248,240,0.65)',
            border: '2px dashed rgba(245,158,11,.35)',
          }}
        >
          <div className="mb-2 text-4xl">📖</div>
          <div className="mb-4 text-[14px] font-bold text-amber-800">还没有语文计划</div>
          <Link
            href="/admin/plans/chinese/new"
            className="inline-block rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-white no-underline"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedPlans.map((plan) => {
            const book = getChineseBook(plan.bookSlug)
            const busy = togglingId === plan.id
            return (
              <article
                key={plan.id}
                className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white/80 shadow-sm"
              >
                <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300" />
                <div className="px-5 py-4">
                  <h3 className="text-[1rem] font-extrabold leading-snug text-slate-900">
                    {plan.title}
                  </h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${statusBadgeClass(plan.status)}`}
                    >
                      {planStatusLabel(plan.status)}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[12px] font-bold text-amber-800">
                      {book?.label ?? plan.bookSlug}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-bold text-slate-500">
                      每批 {plan.lessonsPerBatch} 关
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-bold text-slate-500">
                      {formatPlanQuizTypes(plan.quizTypes)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-bold text-slate-500">
                      更新 {fmtPlanDateTime(plan.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] font-semibold text-slate-500">
                    当前关：{plan.currentLessonKey}
                    {plan.completedLessonKeys.length > 0
                      ? ` · 已通关 ${plan.completedLessonKeys.length} 课`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 bg-amber-50/40 px-5 py-3">
                  <Link
                    href={`/admin/plans/chinese/${plan.id}`}
                    className="rounded-xl border border-[rgba(180,83,9,.35)] bg-[rgba(245,158,11,.08)] px-3.5 py-2 text-[13px] font-extrabold text-amber-800 no-underline transition-colors hover:bg-[rgba(245,158,11,.15)]"
                  >
                    编辑
                  </Link>
                  {plan.status === 'active' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void handlePause(plan)
                      }}
                      className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {busy ? '处理中…' : '暂停'}
                    </button>
                  )}
                  {(plan.status === 'paused' || plan.status === 'completed') && (
                    <button
                      type="button"
                      disabled={busy || plan.status === 'completed'}
                      onClick={() => {
                        void handleActivate(plan)
                      }}
                      className="cursor-pointer rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-extrabold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? '处理中…' : '恢复'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={archivingId === plan.id}
                    onClick={() => {
                      void handleArchive(plan)
                    }}
                    className="ml-auto cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {archivingId === plan.id ? '归档中…' : '归档'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/chinese"
          className="text-[12px] font-bold text-amber-600 no-underline hover:underline"
        >
          前往语文首页 →
        </Link>
      </div>
    </div>
  )
}
