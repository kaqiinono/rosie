'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WeeklyPlan } from '@rosie/core'
import { fmtDate } from '../../utils/english-helpers'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useWeeklyPlan } from '../../hooks/useWeeklyPlan'
import { buildEnglishWeeklyReport } from '../../utils/buildEnglishWeeklyReport'
import { getWeekEnd, daysUntilExpiry } from './english-weekly-plan-shared'
import type { WordEntry } from '@rosie/core'

interface Props {
  vocab: WordEntry[]
}

export default function EnglishWeeklyPlanManage({ vocab }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { allPlans, deletePlan, savePlan, isLoading } = useWeeklyPlan(user)

  const sortedAllPlans = [...allPlans].sort((a, b) => b.weekStart.localeCompare(a.weekStart))

  const handleMarkWeekComplete = async (plan: WeeklyPlan) => {
    if (plan.weekCompletion) return
    if (!window.confirm('确定将本周标记为已结束？将根据当前进度与掌握度生成结课报告并保存。')) return
    const report = buildEnglishWeeklyReport(plan, vocab, masteryMap)
    const weekCompletion = { completedAt: new Date().toISOString(), report }
    const updated: WeeklyPlan = { ...plan, weekCompletion }
    const saved = await savePlan(updated)
    const targetId = saved.id ?? plan.id
    if (targetId) {
      router.push(`/english/words/weekly/${targetId}/report`)
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
    <div className="mx-auto max-w-[1280px] px-4 pt-6 pb-2">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
            英语周计划
          </h1>
          <p className="mt-1 text-[12px] text-[var(--wm-text-dim)]">创建、修改与删除英语每日单词计划</p>
        </div>
        <Link
          href="/admin/plans/english/new"
          className="font-nunito shrink-0 cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[.88rem] font-extrabold text-white no-underline shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
        >
          + 创建周计划
        </Link>
      </div>

      {sortedAllPlans.length === 0 ? (
        <div
          className="rounded-[20px] px-5 py-10 text-center"
          style={{
            background: 'rgba(15,23,42,0.35)',
            border: '2px dashed rgba(96,165,250,.35)',
          }}
        >
          <div className="mb-2 text-4xl">📅</div>
          <div className="mb-4 text-[14px] font-bold text-[#93c5fd]">还没有英语周计划</div>
          <Link
            href="/admin/plans/english/new"
            className="font-nunito inline-block rounded-[10px] bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[.88rem] font-extrabold text-white no-underline"
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedAllPlans.map((plan) => {
            const doneDays = plan.days.filter((d) => plan.progress[d.date]?.quizDone === true).length
            const showWeekExpiry = !plan.weekCompletion
            const remaining = showWeekExpiry ? daysUntilExpiry(plan.weekStart) : 0
            const isExpired = showWeekExpiry && remaining < 0
            const weekEnd = getWeekEnd(plan.weekStart)
            const units = plan.unit.split(', ')
            const lessons = plan.lesson.split(', ')
            const allSameUnit = units.every((u) => u === units[0])
            const lessonLabel = allSameUnit
              ? `${units[0]} · ${lessons.join(', ')}`
              : units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join(', ')
            return (
              <div
                key={plan.id ?? plan.weekStart}
                className="flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] sm:flex-row sm:items-stretch"
              >
                <div className="min-w-0 flex-1 px-5 py-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[1rem] font-bold text-[var(--wm-text)]">
                    {lessonLabel}
                    {plan.weekCompletion && (
                      <span className="rounded-full border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#86efac]">
                        已结课
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                    <span>{fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}</span>
                    <span>{doneDays}/7 天完成</span>
                    {showWeekExpiry && (
                      <span className={isExpired ? 'text-[#f87171]' : 'text-[#fbbf24]'}>
                        {isExpired ? `已过期 ${Math.abs(remaining)} 天` : `还剩 ${remaining} 天`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-row flex-wrap items-center justify-end gap-2 px-4 py-4">
                  {!plan.weekCompletion && plan.id && (
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/plans/english/${plan.id}`)}
                      className="font-nunito cursor-pointer rounded-[10px] border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-3 py-2.5 text-[.75rem] font-extrabold text-[#93c5fd]"
                    >
                      编辑计划
                    </button>
                  )}
                  {!plan.weekCompletion && (
                    <button
                      type="button"
                      onClick={() => { void handleMarkWeekComplete(plan) }}
                      className="font-nunito cursor-pointer rounded-[10px] border border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] px-3 py-2.5 text-[.75rem] font-extrabold text-[#4ade80]"
                    >
                      完成本周
                    </button>
                  )}
                  {plan.weekCompletion && plan.id && (
                    <Link
                      href={`/english/words/weekly/${plan.id}/report`}
                      className="font-nunito rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3 py-2.5 text-[.75rem] font-extrabold text-[#c4b5fd] no-underline"
                    >
                      结课报告
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`确定删除「${lessonLabel}」周计划？`)) {
                        void deletePlan(plan.weekStart)
                      }
                    }}
                    className="cursor-pointer rounded-[10px] border border-[var(--wm-border)] px-3 py-2.5 text-[.75rem] text-[var(--wm-text-dim)] hover:border-[#f87171] hover:text-[#f87171]"
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
