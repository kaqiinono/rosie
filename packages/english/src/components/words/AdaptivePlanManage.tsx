'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@rosie/core'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import type { AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'

function fmtDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

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

export default function AdaptivePlanManage() {
  const { user } = useAuth()
  const { plans, deletePlan, updatePlan, isLoading } = useAdaptiveWordPlan(user)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [savingQuotaPlanId, setSavingQuotaPlanId] = useState<string | null>(null)

  const sortedPlans = [...plans]
    .filter((plan) => plan.status === 'active' || plan.status === 'completed')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  const handleDelete = async (plan: AdaptiveWordPlan) => {
    if (!window.confirm(`确定删除「${plan.title}」自适应计划？`)) return
    setDeletingPlanId(plan.id)
    try {
      await deletePlan(plan.id)
    } finally {
      setDeletingPlanId(null)
    }
  }

  const handleChangeNewWords = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.newWordsPerDay === n) return
    setSavingQuotaPlanId(plan.id)
    try {
      await updatePlan({
        ...plan,
        newWordsPerDay: n,
        reviewCap: Math.max(plan.reviewCap, n * 4),
      })
    } finally {
      setSavingQuotaPlanId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-4 pb-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-fredoka bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] bg-clip-text text-2xl text-transparent">
            英语自适应计划
          </h1>
          <p className="mt-1 text-[12px] text-[var(--wm-text-dim)]">
            创建按掌握度自动推进的单词挑战计划
          </p>
        </div>
        <Link
          href="/admin/plans/english/adaptive/new"
          className="font-nunito shrink-0 cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] px-5 py-2.5 text-[.88rem] font-extrabold text-white no-underline shadow-[0_3px_12px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(124,58,237,.5)]"
        >
          + 创建自适应计划
        </Link>
      </div>

      {sortedPlans.length === 0 ? (
        <div
          className="rounded-[20px] px-5 py-10 text-center"
          style={{
            background: 'rgba(15,23,42,0.35)',
            border: '2px dashed rgba(139,92,246,.35)',
          }}
        >
          <div className="mb-2 text-4xl">🧭</div>
          <div className="mb-4 text-[14px] font-bold text-[#c4b5fd]">还没有英语自适应计划</div>
          <Link
            href="/admin/plans/english/adaptive/new"
            className="font-nunito inline-block rounded-[10px] bg-gradient-to-br from-[#7c3aed] to-[#2563eb] px-5 py-2.5 text-[.88rem] font-extrabold text-white no-underline"
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedPlans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] sm:flex-row sm:items-stretch"
            >
              <div className="min-w-0 flex-1 px-5 py-4">
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
                <div className="mb-2 text-[.74rem] font-bold text-[#c4b5fd]">
                  {scopeLabel(plan)}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[.72rem] text-[var(--wm-text-dim)]">
                  <span>每日新词 {plan.newWordsPerDay}</span>
                  <span>复习上限 {plan.reviewCap}</span>
                  <span>批量 {plan.reviewBatchSize}</span>
                  <span>更新 {fmtDateTime(plan.updatedAt)}</span>
                </div>
                {plan.status === 'active' && (
                  <div className="mt-2.5">
                    <div className="mb-1 text-[.62rem] font-extrabold tracking-wide text-[var(--wm-text-dim)] uppercase">
                      调整每日新词
                      {savingQuotaPlanId === plan.id ? ' · 保存中…' : ''}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={savingQuotaPlanId === plan.id}
                          onClick={() => { void handleChangeNewWords(plan, n) }}
                          className={`h-7 min-w-7 cursor-pointer rounded-full border px-1.5 text-[.72rem] font-extrabold disabled:cursor-wait disabled:opacity-60 ${
                            plan.newWordsPerDay === n
                              ? 'border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                              : 'border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[#8b5cf6] hover:text-[#c4b5fd]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-row flex-wrap items-center justify-end gap-2 px-4 py-4">
                <Link
                  href={`/english/words/adaptive/${plan.id}`}
                  className="font-nunito rounded-[10px] border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-3 py-2.5 text-[.75rem] font-extrabold text-[#93c5fd] no-underline"
                >
                  孩子端练习
                </Link>
                <button
                  type="button"
                  disabled={deletingPlanId === plan.id}
                  onClick={() => { void handleDelete(plan) }}
                  className="cursor-pointer rounded-[10px] border border-[var(--wm-border)] px-3 py-2.5 text-[.75rem] text-[var(--wm-text-dim)] hover:border-[#f87171] hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingPlanId === plan.id ? '删除中…' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/english/words/daily" className="text-[12px] font-bold text-[#93c5fd] no-underline hover:underline">
          前往练习 →
        </Link>
      </div>
    </div>
  )
}
