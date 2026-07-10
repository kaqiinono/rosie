'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WordEntry } from '@rosie/core'
import { todayStr, useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import { findWordByKey } from '../../utils/english-helpers'
import {
  buildDailyTask,
  type AdaptiveDailyTask,
} from '../../utils/adaptivePlanScheduler'
import {
  ADAPTIVE_MASTERED_STAGE,
  adaptiveBoxStage,
} from '../../utils/adaptivePlanStages'
import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'

function progressStats(rows: AdaptivePlanWordProgress[]) {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const total = activeRows.length
  const mastered = activeRows.filter((row) => row.status === 'MASTERED').length
  return { total, mastered }
}

type PlanDaySnapshot = {
  dailyTask: AdaptiveDailyTask
  mastered: number
  total: number
}

type DailyWordCapsule = {
  wordKey: string
  word: string
  boxEmoji: string
  kind: 'new' | 'review' | 'boss'
}

function boxEmojiForRow(row: AdaptivePlanWordProgress | undefined): string {
  if (!row) return '🥚'
  if (row.status === 'MASTERED') return ADAPTIVE_MASTERED_STAGE.emoji
  if (row.status === 'LEARNING_PENDING') return '🐣'
  if (row.status === 'NOT_STARTED') return '🥚'
  return adaptiveBoxStage(row.boxIndex).emoji
}

function buildDailyWordCapsules(
  dailyTask: AdaptiveDailyTask,
  rows: AdaptivePlanWordProgress[],
  vocab: WordEntry[],
): DailyWordCapsule[] {
  const byKey = new Map(
    rows.filter((row) => row.archivedAt == null).map((row) => [row.wordKey, row]),
  )
  const seen = new Set<string>()
  const capsules: DailyWordCapsule[] = []

  const add = (keys: string[], kind: DailyWordCapsule['kind']) => {
    for (const key of keys) {
      if (seen.has(key)) continue
      seen.add(key)
      const entry = findWordByKey(vocab, key)
      const word = entry?.word ?? key.split('::').pop() ?? key
      capsules.push({
        wordKey: key,
        word,
        boxEmoji: boxEmojiForRow(byKey.get(key)),
        kind,
      })
    }
  }

  add(dailyTask.activateKeys, 'new')
  add(dailyTask.reviewKeys, 'review')
  add(dailyTask.bossKeys, 'boss')
  return capsules
}

const CAPSULE_KIND_CLASS: Record<DailyWordCapsule['kind'], string> = {
  new: 'border-[rgba(139,92,246,.4)] bg-[rgba(139,92,246,.1)] text-[#c4b5fd]',
  review: 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd]',
  boss: 'border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.1)] text-[#fbbf24]',
}

export default function AdaptivePlanPractice() {
  const router = useRouter()
  const { user } = useAuth()
  const { vocab } = useWordsContext()
  const { plans, isLoading, loadProgressForPlans } = useAdaptiveWordPlan(user)
  const [dayByPlanId, setDayByPlanId] = useState<Record<string, PlanDaySnapshot>>({})
  const [rowsByPlanId, setRowsByPlanId] = useState<Record<string, AdaptivePlanWordProgress[]>>({})

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
      setDayByPlanId({})
      setRowsByPlanId({})
      return
    }

    let cancelled = false
    const today = todayStr()

    void loadProgressForPlans(activePlans.map((plan) => plan.id))
      .then((rowsByPlanId) => {
        if (cancelled) return
        const entries = activePlans.map((plan) => {
          const rows = rowsByPlanId[plan.id] ?? []
          const stats = progressStats(rows)
          const dailyTask = buildDailyTask(plan, rows, today)
          return [
            plan.id,
            {
              dailyTask,
              mastered: stats.mastered,
              total: stats.total,
            } satisfies PlanDaySnapshot,
          ] as const
        })
        setDayByPlanId(Object.fromEntries(entries))
        setRowsByPlanId(rowsByPlanId)
      })
      .catch((err) => {
        console.error('[adaptive_word_plan] practice list progress load failed', err)
      })

    return () => {
      cancelled = true
    }
  }, [activePlans, loadProgressForPlans])

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
              const daySnapshot = dayByPlanId[plan.id]
              const rows = rowsByPlanId[plan.id]
              const capsules =
                plan.status === 'active' && daySnapshot && rows
                  ? buildDailyWordCapsules(daySnapshot.dailyTask, rows, vocab)
                  : []
              return (
                <div
                  key={plan.id}
                  className="group flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)]"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/english/words/adaptive/${plan.id}`)}
                    className="min-h-0 min-w-0 w-full cursor-pointer rounded-t-[14px] px-3 py-3 text-left sm:px-5 sm:py-4"
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
                    <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                      <span>每日新词 {plan.newWordsPerDay}</span>
                      <span>复习上限 {plan.reviewCap}</span>
                      {plan.status === 'active' && daySnapshot && (
                        <>
                          <span>
                            已掌握 {daySnapshot.mastered}/{daySnapshot.total}
                          </span>
                          <span>
                            今日新学 {daySnapshot.dailyTask.activateKeys.length} · 复习{' '}
                            {daySnapshot.dailyTask.reviewKeys.length}
                          </span>
                        </>
                      )}
                    </div>
                    {plan.status === 'active' && (
                      <div className="mt-2.5">
                        {!daySnapshot || !rows ? (
                          <div className="text-[.72rem] text-[var(--wm-text-dim)]">
                            加载今日单词…
                          </div>
                        ) : capsules.length === 0 ? (
                          <div className="text-[.72rem] text-[var(--wm-text-dim)]">
                            今日暂无待练单词
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {capsules.map((capsule) => (
                              <span
                                key={capsule.wordKey}
                                className={`inline-flex items-center rounded-2xl border-[1.5px] px-2.5 py-1 text-[0.875rem] font-bold leading-tight ${CAPSULE_KIND_CLASS[capsule.kind]}`}
                              >
                                <span className="mr-1 text-[.75rem] leading-none">
                                  {capsule.boxEmoji}
                                </span>
                                {capsule.word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                  <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 px-3 pb-3 sm:gap-2 sm:px-5 sm:pb-4">
                    <Link
                      href={`/english/words/adaptive/${plan.id}/preview`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-nunito rounded-[10px] border border-[rgba(139,92,246,.35)] bg-[rgba(139,92,246,.1)] px-2.5 py-2.5 text-[.72rem] font-extrabold whitespace-nowrap text-[#c4b5fd] no-underline sm:px-3 sm:text-[.75rem]"
                    >
                      轨迹预览
                    </Link>
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
