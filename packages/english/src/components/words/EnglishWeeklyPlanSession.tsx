'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WordEntry } from '@rosie/core'
import { fmtDate, formatPlanLessonLabel, getOldReviewWords } from '../../utils/english-helpers'
import AdaptivePlanPractice from './AdaptivePlanPractice'
import MasteryStatusPanel from './MasteryStatusPanel'
import OldReviewSession from './OldReviewSession'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useWeeklyPlan } from '../../hooks/useWeeklyPlan'
import { todayStr } from '@rosie/core'
import { planDayCount, planEndDate, daysUntilExpiry } from './english-weekly-plan-shared'

interface Props {
  vocab: WordEntry[]
}

type PlanTab = 'multi' | 'adaptive'

function MultiDayPlanPractice({ vocab }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const { allPlans, isLoading } = useWeeklyPlan(user)
  const [showOldReview, setShowOldReview] = useState(false)

  const sortedAllPlans = useMemo(
    () => [...allPlans].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [allPlans],
  )

  const currentAndNextWeekPlans = useMemo(() => {
    const today = todayStr()
    const sorted = [...allPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    let currentIdx = -1
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].weekStart <= today) {
        currentIdx = i
        break
      }
    }
    const result: typeof allPlans = []
    if (currentIdx >= 0) result.push(sorted[currentIdx])
    if (currentIdx + 1 < sorted.length) result.push(sorted[currentIdx + 1])
    return result
  }, [allPlans])

  const oldReviewWords = useMemo(
    () => getOldReviewWords(vocab, masteryMap, currentAndNextWeekPlans),
    [vocab, masteryMap, currentAndNextWeekPlans],
  )

  if (showOldReview) {
    return (
      <OldReviewSession
        words={oldReviewWords}
        vocab={vocab}
        onBack={() => setShowOldReview(false)}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-4 pt-2 pb-3">
        <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-2xl text-transparent">
              多日计划
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {oldReviewWords.length > 0 && (
                <button
                  onClick={() => setShowOldReview(true)}
                  className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.08)] px-4 py-2.5 text-[.88rem] font-extrabold text-[#c4b5fd] transition-all hover:border-[rgba(167,139,250,.7)] hover:bg-[rgba(167,139,250,.15)]"
                >
                  📚 旧词复习
                  <span className="rounded-full bg-[rgba(167,139,250,.25)] px-1.5 py-0.5 text-[.72rem] font-black text-[#a78bfa]">
                    {oldReviewWords.length}
                  </span>
                </button>
              )}
            </div>
          </div>
          {sortedAllPlans.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--wm-text-dim)]">
              <div className="flex flex-col items-center gap-3">
                <span>暂无多日计划</span>
                <span className="text-[.75rem]">请家长在管理后台创建英语多日计划</span>
                <Link
                  href="/admin/plans/english"
                  className="font-nunito rounded-[10px] border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-4 py-2 text-[.8rem] font-extrabold text-[#93c5fd] no-underline"
                >
                  前往计划管理
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sortedAllPlans.map((plan) => {
                const doneDays = plan.days.filter(
                  (d) => plan.progress[d.date]?.quizDone === true,
                ).length
                const showWeekExpiry = !plan.weekCompletion
                const totalDays = planDayCount(plan)
                const remaining = showWeekExpiry ? daysUntilExpiry(planEndDate(plan)) : 0
                const isExpired = showWeekExpiry && remaining < 0
                const weekEnd = planEndDate(plan)
                const lessonLabel = formatPlanLessonLabel(plan.unit, plan.lesson)
                return (
                  <div
                    key={plan.id ?? plan.weekStart}
                    className="group flex flex-col rounded-[14px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] transition-all hover:border-[var(--wm-accent)] hover:bg-[var(--wm-surface)] sm:flex-row sm:items-stretch"
                  >
                    <button
                      onClick={() => {
                        if (plan.id) router.push('/english/words/weekly/' + plan.id)
                      }}
                      className="min-h-0 min-w-0 flex-1 cursor-pointer rounded-t-[14px] px-3 py-3 text-left sm:rounded-l-[14px] sm:rounded-tr-none sm:px-5 sm:py-4"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[1rem] font-bold text-[var(--wm-text)]">
                        {lessonLabel}
                        {plan.weekCompletion && (
                          <span className="rounded-full border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#86efac]">
                            已结课
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[.72rem] text-[var(--wm-text-dim)]">
                        <span>
                          {fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}
                        </span>
                        <span>{doneDays}/{totalDays} 天完成</span>
                        {showWeekExpiry && (
                          <span className={isExpired ? 'text-[#f87171]' : 'text-[#fbbf24]'}>
                            {isExpired
                              ? `已过期 ${Math.abs(remaining)} 天`
                              : `还剩 ${remaining} 天`}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 px-3 pt-1 pb-3 sm:flex-none sm:flex-nowrap sm:gap-2 sm:self-center sm:px-4 sm:py-4 sm:pt-4 sm:pl-0">
                      {plan.weekCompletion && plan.id && (
                        <Link
                          href={`/english/words/weekly/${plan.id}/report`}
                          className="font-nunito inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface2)] px-2.5 py-2.5 text-center text-[.72rem] font-extrabold whitespace-nowrap text-[#c4b5fd] transition-all hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.12)] sm:px-3 sm:text-[.75rem]"
                        >
                          结课报告
                        </Link>
                      )}
                      {plan.id && (
                        <span className="font-nunito rounded-[10px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.1)] px-2.5 py-2.5 text-[.72rem] font-extrabold whitespace-nowrap text-[#fbbf24] sm:px-3 sm:text-[.75rem]">
                          开始练习 →
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-[1280px]">
        <MasteryStatusPanel
          vocab={vocab}
          masteryMap={masteryMap}
          panelTitle="全局词汇学习状态"
        />
      </div>
    </>
  )
}

export default function EnglishWeeklyPlanSession({ vocab }: Props) {
  const [tab, setTab] = useState<PlanTab>('multi')

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-4 pt-5 pb-1">
        <div
          className="inline-flex rounded-xl border border-[var(--wm-border)] bg-white/[.03] p-1"
          role="tablist"
          aria-label="练习计划类型"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'multi'}
            onClick={() => setTab('multi')}
            className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-extrabold transition-colors ${
              tab === 'multi'
                ? 'bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                : 'text-[var(--wm-text-dim)] hover:text-[#fbbf24]'
            }`}
          >
            多日计划
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'adaptive'}
            onClick={() => setTab('adaptive')}
            className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-extrabold transition-colors ${
              tab === 'adaptive'
                ? 'bg-[rgba(139,92,246,.15)] text-[#c4b5fd]'
                : 'text-[var(--wm-text-dim)] hover:text-[#c4b5fd]'
            }`}
          >
            自适应计划
          </button>
        </div>
      </div>

      {tab === 'multi' ? <MultiDayPlanPractice vocab={vocab} /> : null}
      {tab === 'adaptive' ? <AdaptivePlanPractice /> : null}
    </>
  )
}
