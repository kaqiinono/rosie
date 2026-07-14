'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WeeklyPlan } from '@rosie/core'
import { fmtDate, formatPlanLessonLabel } from '../../utils/english-helpers'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useWeeklyPlan } from '../../hooks/useWeeklyPlan'
import { buildEnglishWeeklyReport } from '../../utils/buildEnglishWeeklyReport'
import { planDayCount, planEndDate, daysUntilExpiry } from './english-weekly-plan-shared'
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
    if (!window.confirm('确定将本计划标记为已结束？将根据当前进度与掌握度生成结课报告并保存。')) return
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
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-xl font-extrabold text-transparent">
            多日计划
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--wm-text-dim)]">按课程与日期分配每日单词</p>
        </div>
        <Link
          href="/admin/plans/english/new"
          className="font-nunito shrink-0 cursor-pointer rounded-xl border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[13px] font-extrabold text-white no-underline shadow-[0_3px_12px_rgba(245,158,11,.35)] transition-all hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]"
        >
          + 创建多日计划
        </Link>
      </div>

      {sortedAllPlans.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{
            background: 'rgba(15,23,42,0.35)',
            border: '2px dashed rgba(245,158,11,.35)',
          }}
        >
          <div className="mb-2 text-4xl">📅</div>
          <div className="mb-4 text-[14px] font-bold text-[#fbbf24]">还没有多日计划</div>
          <Link
            href="/admin/plans/english/new"
            className="font-nunito inline-block rounded-xl bg-gradient-to-br from-[#d97706] to-[#f59e0b] px-5 py-2.5 text-[13px] font-extrabold text-white no-underline"
          >
            创建第一个计划
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedAllPlans.map((plan) => {
            const doneDays = plan.days.filter((d) => plan.progress[d.date]?.quizDone === true).length
            const showWeekExpiry = !plan.weekCompletion
            const totalDays = planDayCount(plan)
            const remaining = showWeekExpiry ? daysUntilExpiry(planEndDate(plan)) : 0
            const isExpired = showWeekExpiry && remaining < 0
            const weekEnd = planEndDate(plan)
            const lessonLabel = formatPlanLessonLabel(plan.unit, plan.lesson)
            return (
              <article
                key={plan.id ?? plan.weekStart}
                className="overflow-hidden rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface2)]"
              >
                <div className="h-1 bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24]" />
                <div className="px-5 py-4">
                  <h3 className="text-[1rem] font-extrabold leading-snug text-[var(--wm-text)]">
                    {lessonLabel}
                  </h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--wm-border)] bg-[rgba(255,255,255,.04)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--wm-text-dim)]">
                      {fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}
                    </span>
                    <span className="rounded-full border border-[rgba(96,165,250,.3)] bg-[rgba(96,165,250,.08)] px-2.5 py-0.5 text-[12px] font-bold text-[#93c5fd]">
                      {doneDays}/{totalDays} 天完成
                    </span>
                    {showWeekExpiry && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[12px] font-bold ${
                          isExpired
                            ? 'border-[rgba(248,113,113,.35)] bg-[rgba(248,113,113,.1)] text-[#f87171]'
                            : 'border-[rgba(251,191,36,.35)] bg-[rgba(251,191,36,.1)] text-[#fbbf24]'
                        }`}
                      >
                        {isExpired ? `已过期 ${Math.abs(remaining)} 天` : `还剩 ${remaining} 天`}
                      </span>
                    )}
                    {plan.weekCompletion && (
                      <span className="rounded-full border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] px-2.5 py-0.5 text-[12px] font-extrabold text-[#86efac]">
                        已结课
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--wm-border)] bg-[rgba(0,0,0,.12)] px-5 py-3">
                  {!plan.weekCompletion && plan.id && (
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/plans/english/${plan.id}`)}
                      className="font-nunito cursor-pointer rounded-xl border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-3.5 py-2 text-[13px] font-extrabold text-[#93c5fd] transition-colors hover:bg-[rgba(96,165,250,.15)]"
                    >
                      编辑计划
                    </button>
                  )}
                  {!plan.weekCompletion && (
                    <button
                      type="button"
                      onClick={() => { void handleMarkWeekComplete(plan) }}
                      className="font-nunito cursor-pointer rounded-xl border border-[rgba(74,222,128,.4)] bg-[rgba(74,222,128,.1)] px-3.5 py-2 text-[13px] font-extrabold text-[#4ade80] transition-colors hover:bg-[rgba(74,222,128,.18)]"
                    >
                      完成计划
                    </button>
                  )}
                  {plan.weekCompletion && plan.id && (
                    <Link
                      href={`/english/words/weekly/${plan.id}/report`}
                      className="font-nunito rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-3.5 py-2 text-[13px] font-extrabold text-[#c4b5fd] no-underline transition-colors hover:border-[rgba(196,181,253,.4)]"
                    >
                      结课报告
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`确定删除「${lessonLabel}」多日计划？`)) {
                        void deletePlan(plan.weekStart)
                      }
                    }}
                    className="ml-auto cursor-pointer rounded-xl border border-[var(--wm-border)] px-3.5 py-2 text-[13px] font-bold text-[var(--wm-text-dim)] transition-colors hover:border-[#f87171] hover:text-[#f87171]"
                  >
                    删除
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
