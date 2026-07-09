'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { todayStr } from '@rosie/core'
import {
  buildDailyTask,
  useAdaptiveWordPlan,
  type AdaptivePlanWordProgress,
} from '@rosie/english'

function progressStats(rows: AdaptivePlanWordProgress[]) {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const total = activeRows.length
  const mastered = activeRows.filter((row) => row.status === 'MASTERED').length
  return { total, mastered }
}

type AdaptivePlanTodayCardProps = {
  user: User | null
}

export default function AdaptivePlanTodayCard({ user }: AdaptivePlanTodayCardProps) {
  const { plans, isLoading: plansLoading, loadProgress } = useAdaptiveWordPlan(user)
  const activePlan = useMemo(
    () => plans.find((plan) => plan.status === 'active') ?? null,
    [plans],
  )

  const [progressRows, setProgressRows] = useState<AdaptivePlanWordProgress[] | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)

  useEffect(() => {
    if (!activePlan) {
      setProgressRows(null)
      return
    }

    let cancelled = false
    setProgressLoading(true)

    void loadProgress(activePlan.id).then((rows) => {
      if (cancelled) return
      setProgressRows(rows)
      setProgressLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [activePlan, loadProgress])

  if (plansLoading || !activePlan) return null

  const today = todayStr()
  const stats = progressRows ? progressStats(progressRows) : null
  const dailyTask =
    progressRows && activePlan ? buildDailyTask(activePlan, progressRows, today) : null
  const newCount = dailyTask?.activateKeys.length ?? 0
  const reviewCount = dailyTask?.reviewKeys.length ?? 0
  const pct = stats && stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-extrabold flex items-center gap-2 text-text-primary">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_3px_10px_rgba(99,102,241,.3)]">
            🧠
          </span>
          自适应单词计划
        </h2>
        <Link
          href={`/english/words/adaptive/${activePlan.id}`}
          className="text-[12px] font-bold no-underline flex items-center gap-1 transition-opacity hover:opacity-70 text-indigo-600"
        >
          前往练习 →
        </Link>
      </div>

      <Link
        href={`/english/words/adaptive/${activePlan.id}`}
        className="block rounded-2xl px-4 py-4 no-underline transition-all hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
          border: '1.5px solid rgba(99,102,241,.22)',
          boxShadow: '0 4px 16px rgba(99,102,241,.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              boxShadow: '0 3px 10px rgba(99,102,241,.3)',
            }}
          >
            🧠
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold truncate text-indigo-900">
              {activePlan.title}
            </div>
            {progressLoading ? (
              <div className="text-[11px] mt-0.5 font-medium text-indigo-400">加载进度…</div>
            ) : stats ? (
              <>
                <div className="text-[11px] mt-0.5 font-medium text-indigo-700">
                  已掌握 {stats.mastered}/{stats.total}
                  {dailyTask && (
                    <>
                      <span className="mx-1.5 text-indigo-300">·</span>
                      今日新学 {newCount} · 复习 {reviewCount}
                    </>
                  )}
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,.12)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-[11px] mt-0.5 font-medium text-indigo-600">点击进入今日任务</div>
            )}
          </div>
          <span className="text-[14px] font-extrabold text-indigo-500">→</span>
        </div>
      </Link>
    </section>
  )
}
