'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { todayStr, useAuth } from '@rosie/core'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { wordKey } from '../../utils/english-helpers'
import { clampNewWordsPerDay, defaultReviewCap } from '../../utils/adaptivePlanDefaults'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { useWordsContext } from '../../WordsContext'
import AdaptivePlanSettingsPanel from './AdaptivePlanSettingsPanel'
import AdaptivePlanStageRoadmap from './AdaptivePlanStageRoadmap'

function fmtDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function AdaptivePlanManage() {
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const { plans, deletePlan, updatePlan, archiveOrphanWords, loadProgressForPlans, loadProgress, isLoading } =
    useAdaptiveWordPlan(user)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [settingsPlanId, setSettingsPlanId] = useState<string | null>(null)
  const [savingQuotaPlanId, setSavingQuotaPlanId] = useState<string | null>(null)
  const [savingTuningPlanId, setSavingTuningPlanId] = useState<string | null>(null)
  const [cleaningPlanId, setCleaningPlanId] = useState<string | null>(null)
  const [progressByPlanId, setProgressByPlanId] = useState<Record<string, AdaptivePlanWordProgress[]>>({})
  // Orphan rows (word deleted from the vocab) per active plan — the cleanup
  // button is an anomaly-repair tool and only shows when something is wrong.
  const [orphanCountByPlanId, setOrphanCountByPlanId] = useState<Record<string, number>>({})

  const vocabKeySet = useMemo(() => new Set(vocab.map((entry) => wordKey(entry))), [vocab])

  const sortedPlans = [...plans]
    .filter((plan) => plan.status === 'active' || plan.status === 'completed')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  const displayPlanIds = useMemo(
    () =>
      plans
        .filter((plan) => plan.status === 'active' || plan.status === 'completed')
        .map((plan) => plan.id)
        .sort(),
    [plans],
  )

  useEffect(() => {
    if (!user || displayPlanIds.length === 0) {
      setProgressByPlanId({})
      setOrphanCountByPlanId({})
      return
    }

    let cancelled = false
    void loadProgressForPlans(displayPlanIds)
      .then((rowsByPlanId) => {
        if (cancelled) return
        setProgressByPlanId(rowsByPlanId)
        const counts: Record<string, number> = {}
        if (vocabKeySet.size > 0) {
          for (const [id, rows] of Object.entries(rowsByPlanId)) {
            counts[id] = rows.filter(
              (row) => row.archivedAt == null && !vocabKeySet.has(row.wordKey),
            ).length
          }
        }
        setOrphanCountByPlanId(counts)
      })
      .catch((err) => {
        console.error('[adaptive_word_plan] progress load failed', err)
      })

    return () => {
      cancelled = true
    }
  }, [user, displayPlanIds, loadProgressForPlans, vocabKeySet])

  const handleDelete = async (plan: AdaptiveWordPlan) => {
    if (!window.confirm(`确定删除「${plan.title}」自适应计划？`)) return
    setDeletingPlanId(plan.id)
    try {
      await deletePlan(plan.id)
      setSettingsPlanId((prev) => (prev === plan.id ? null : prev))
    } finally {
      setDeletingPlanId(null)
    }
  }

  const handleCleanOrphans = async (plan: AdaptiveWordPlan) => {
    const count = orphanCountByPlanId[plan.id] ?? 0
    if (
      !window.confirm(
        `「${plan.title}」中有 ${count} 个词已从词库删除，无法出题且会卡住计划完成。归档这些失效词？`,
      )
    ) {
      return
    }
    setCleaningPlanId(plan.id)
    try {
      const archived = await archiveOrphanWords(plan.id, vocabKeySet)
      setOrphanCountByPlanId((prev) => ({ ...prev, [plan.id]: 0 }))
      window.alert(`已归档 ${archived} 个失效词。`)
    } catch (err) {
      console.error('[adaptive_word_plan] clean orphans failed', err)
      window.alert('清理失败，请检查网络后重试。')
    } finally {
      setCleaningPlanId(null)
    }
  }

  const handleChangeNewWords = async (plan: AdaptiveWordPlan, n: number) => {
    const next = clampNewWordsPerDay(n)
    const nextReviewCap = Math.max(plan.reviewCap, defaultReviewCap(next))
    if (
      plan.status !== 'active' ||
      (plan.newWordsPerDay === next && plan.reviewCap === nextReviewCap)
    ) {
      return
    }
    setSavingQuotaPlanId(plan.id)
    try {
      await updatePlan({
        ...plan,
        newWordsPerDay: next,
        reviewCap: nextReviewCap,
      })
    } finally {
      setSavingQuotaPlanId(null)
    }
  }

  const handleChangeReviewCap = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.reviewCap === n) return
    setSavingTuningPlanId(plan.id)
    try {
      await updatePlan({ ...plan, reviewCap: n })
    } finally {
      setSavingTuningPlanId(null)
    }
  }

  const handleChangeBacklogFuse = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.backlogFuse === n) return
    setSavingTuningPlanId(plan.id)
    try {
      await updatePlan({ ...plan, backlogFuse: n })
    } finally {
      setSavingTuningPlanId(null)
    }
  }

  const handleChangeBossEveryNNew = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.bossEveryNNew === n) return
    setSavingTuningPlanId(plan.id)
    try {
      await updatePlan({ ...plan, bossEveryNNew: n })
    } finally {
      setSavingTuningPlanId(null)
    }
  }

  const handleChangeBossStubbornThreshold = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.bossStubbornThreshold === n) return
    setSavingTuningPlanId(plan.id)
    try {
      await updatePlan({ ...plan, bossStubbornThreshold: n })
    } finally {
      setSavingTuningPlanId(null)
    }
  }

  const handleChangeBossPackLimit = async (plan: AdaptiveWordPlan, n: number) => {
    if (plan.status !== 'active' || plan.bossPackLimit === n) return
    setSavingTuningPlanId(plan.id)
    try {
      await updatePlan({ ...plan, bossPackLimit: n })
    } finally {
      setSavingTuningPlanId(null)
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
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-fredoka bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] bg-clip-text text-xl font-extrabold text-transparent">
            自适应计划
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--wm-text-dim)]">按掌握度自动推进的单词挑战</p>
        </div>
        <Link
          href="/admin/plans/english/adaptive/new"
          className="font-nunito shrink-0 cursor-pointer rounded-xl border-0 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] px-5 py-2.5 text-[13px] font-extrabold text-white no-underline shadow-[0_3px_12px_rgba(124,58,237,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(124,58,237,.5)]"
        >
          + 创建自适应计划
        </Link>
      </div>

      {sortedPlans.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{
            background: 'rgba(15,23,42,0.35)',
            border: '2px dashed rgba(139,92,246,.35)',
          }}
        >
          <div className="mb-2 text-4xl">🧭</div>
          <div className="mb-4 text-[14px] font-bold text-[#c4b5fd]">还没有自适应计划</div>
          <Link
            href="/admin/plans/english/adaptive/new"
            className="font-nunito inline-block rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb] px-5 py-2.5 text-[13px] font-extrabold text-white no-underline"
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedPlans.map((plan) => {
            const settingsOpen = settingsPlanId === plan.id
            const planRows = (progressByPlanId[plan.id] ?? []).filter(
              (row) => row.archivedAt == null,
            )
            return (
            <article
              key={plan.id}
              className="overflow-hidden rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface2)]"
            >
              <div className="h-1 bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#60a5fa]" />
              <div className="px-5 py-4">
                <div>
                  {planRows.length > 0 ? (
                    <AdaptivePlanStageRoadmap
                      rows={planRows}
                      today={todayStr()}
                      compact
                      className="border-0 bg-transparent px-0 py-0"
                    />
                  ) : progressByPlanId[plan.id] ? (
                    <div className="text-[12px] font-bold text-[var(--wm-text-dim)]">
                      暂无有效单词进度
                    </div>
                  ) : (
                    <div className="text-[12px] font-bold text-[var(--wm-text-dim)]">
                      加载词汇状态…
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${
                      plan.status === 'completed'
                        ? 'border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] text-[#86efac]'
                        : 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.1)] text-[#93c5fd]'
                    }`}
                  >
                    {plan.status === 'completed' ? '已完成' : '进行中'}
                  </span>
                  <span className="rounded-full border border-[var(--wm-border)] bg-[rgba(255,255,255,.04)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--wm-text-dim)]">
                    每日新词 {plan.newWordsPerDay}
                  </span>
                  <span className="rounded-full border border-[var(--wm-border)] bg-[rgba(255,255,255,.04)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--wm-text-dim)]">
                    更新 {fmtDateTime(plan.updatedAt)}
                  </span>
                </div>
              </div>

              {plan.status === 'active' && settingsOpen && (
                <AdaptivePlanSettingsPanel
                  plan={plan}
                  loadProgress={loadProgress}
                  onChangeNewWords={(n) => { void handleChangeNewWords(plan, n) }}
                  onChangeReviewCap={(n) => { void handleChangeReviewCap(plan, n) }}
                  onChangeBacklogFuse={(n) => { void handleChangeBacklogFuse(plan, n) }}
                  onChangeBossEveryNNew={(n) => { void handleChangeBossEveryNNew(plan, n) }}
                  onChangeBossStubbornThreshold={(n) => {
                    void handleChangeBossStubbornThreshold(plan, n)
                  }}
                  onChangeBossPackLimit={(n) => { void handleChangeBossPackLimit(plan, n) }}
                  savingQuota={savingQuotaPlanId === plan.id}
                  savingTuning={savingTuningPlanId === plan.id}
                />
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--wm-border)] bg-[rgba(0,0,0,.12)] px-5 py-3">
                <Link
                  href={`/english/words/adaptive/${plan.id}/preview`}
                  className="font-nunito rounded-xl border border-[rgba(139,92,246,.4)] bg-[rgba(139,92,246,.08)] px-3.5 py-2 text-[13px] font-extrabold text-[#c4b5fd] no-underline transition-colors hover:bg-[rgba(139,92,246,.15)]"
                >
                  轨迹预览
                </Link>
                <Link
                  href={`/english/words/adaptive/${plan.id}`}
                  className="font-nunito rounded-xl border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-3.5 py-2 text-[13px] font-extrabold text-[#93c5fd] no-underline transition-colors hover:bg-[rgba(96,165,250,.15)]"
                >
                  孩子端练习
                </Link>
                {plan.status === 'active' && (
                  <button
                    type="button"
                    aria-expanded={settingsOpen}
                    onClick={() => setSettingsPlanId(settingsOpen ? null : plan.id)}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-[13px] font-extrabold transition-colors ${
                      settingsOpen
                        ? 'border-[rgba(139,92,246,.5)] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                        : 'border-[var(--wm-border)] bg-[rgba(255,255,255,.04)] text-[var(--wm-text-dim)] hover:border-[rgba(139,92,246,.4)] hover:text-[#c4b5fd]'
                    }`}
                  >
                    {settingsOpen ? '收起设置' : '设置'}
                  </button>
                )}
                {plan.status === 'active' && (orphanCountByPlanId[plan.id] ?? 0) > 0 && (
                  <button
                    type="button"
                    disabled={cleaningPlanId === plan.id}
                    onClick={() => { void handleCleanOrphans(plan) }}
                    className="cursor-pointer rounded-xl border border-[rgba(251,191,36,.45)] bg-[rgba(251,191,36,.08)] px-3.5 py-2 text-[13px] font-extrabold text-[#fbbf24] disabled:cursor-wait disabled:opacity-50"
                  >
                    {cleaningPlanId === plan.id
                      ? '清理中…'
                      : `清理 ${orphanCountByPlanId[plan.id]} 个失效词`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={deletingPlanId === plan.id}
                  onClick={() => { void handleDelete(plan) }}
                  className="ml-auto cursor-pointer rounded-xl border border-[var(--wm-border)] px-3.5 py-2 text-[13px] font-bold text-[var(--wm-text-dim)] transition-colors hover:border-[#f87171] hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingPlanId === plan.id ? '删除中…' : '删除'}
                </button>
              </div>
            </article>
            )
          })}
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
