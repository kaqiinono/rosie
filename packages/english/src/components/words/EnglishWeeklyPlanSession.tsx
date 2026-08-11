'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WeeklyPlan, WordEntry } from '@rosie/core'
import {
  fmtDate,
  findWordByKey,
  formatPlanLessonLabel,
  getOldReviewWords,
  wordKey,
} from '../../utils/english-helpers'
import MasteryStatusPanel from './MasteryStatusPanel'
import OldReviewSession from './OldReviewSession'
import { todayStr, useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { useWeeklyPlan } from '../../hooks/useWeeklyPlan'
import { useAdaptiveWordPlan } from '../../hooks/useAdaptiveWordPlan'
import {
  buildDailyTask,
  type AdaptiveDailyTask,
} from '../../utils/adaptivePlanScheduler'
import {
  ADAPTIVE_MASTERED_STAGE,
  ADAPTIVE_NOT_STARTED_STAGE,
  ADAPTIVE_PENDING_STAGE,
  adaptiveBoxStage,
} from '../../utils/adaptivePlanStages'
import type { AdaptivePlanWordProgress, AdaptiveWordPlan } from '../../utils/adaptivePlanTypes'
import { planDayCount, planEndDate, daysUntilExpiry } from './english-weekly-plan-shared'

interface Props {
  vocab: WordEntry[]
  stage: string
}

type PlanCardKind = 'weekly' | 'adaptive'

type UnifiedPlanCard = {
  key: string
  kind: PlanCardKind
  incomplete: boolean
  sortDate: string
  weekly?: WeeklyPlan
  adaptive?: AdaptiveWordPlan
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

const CAPSULE_KIND_CLASS: Record<DailyWordCapsule['kind'], string> = {
  new: 'border-[rgba(139,92,246,.4)] bg-[rgba(139,92,246,.1)] text-[#c4b5fd]',
  review: 'border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] text-[#93c5fd]',
  boss: 'border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.1)] text-[#fbbf24]',
}

function progressStats(rows: AdaptivePlanWordProgress[]) {
  const activeRows = rows.filter((row) => row.archivedAt == null)
  const total = activeRows.length
  const mastered = activeRows.filter((row) => row.status === 'MASTERED').length
  return { total, mastered }
}

function boxEmojiForRow(row: AdaptivePlanWordProgress | undefined): string {
  if (!row) return ADAPTIVE_NOT_STARTED_STAGE.emoji
  if (row.status === 'MASTERED') return ADAPTIVE_MASTERED_STAGE.emoji
  if (row.status === 'LEARNING_PENDING') return ADAPTIVE_PENDING_STAGE.emoji
  if (row.status === 'NOT_STARTED') return ADAPTIVE_NOT_STARTED_STAGE.emoji
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

function isWeeklyIncomplete(plan: WeeklyPlan): boolean {
  if (plan.weekCompletion) return false
  const totalDays = planDayCount(plan)
  if (totalDays === 0) return true
  const doneDays = plan.days.filter((d) => plan.progress[d.date]?.quizDone === true).length
  return doneDays < totalDays
}

function adaptivePlanMatchesStage(
  plan: AdaptiveWordPlan,
  stage: string,
  lessonKeys: Set<string>,
): boolean {
  if (!stage) return true
  const stages = plan.scope.stages ?? []
  if (stages.length > 0) return stages.includes(stage)

  const scopedLessons = plan.scope.lessonKeys ?? []
  if (scopedLessons.length > 0) {
    return scopedLessons.some((key) => lessonKeys.has(key))
  }

  // Legacy plans may have neither field; keep them visible rather than making
  // an existing plan unreachable.
  return true
}

function weeklyPlanMatchesStage(plan: WeeklyPlan, wordKeys: Set<string>): boolean {
  const plannedKeys = plan.days.flatMap((day) => day.newWordKeys)
  return plannedKeys.some((key) => wordKeys.has(key))
}

function cardShellClass(kind: PlanCardKind, isCurrent: boolean): string {
  const base =
    'group flex h-full flex-col rounded-[16px] border bg-[var(--wm-surface2)] transition-all'
  if (isCurrent) {
    return kind === 'weekly'
      ? `${base} border-[rgba(245,158,11,.75)] bg-[rgba(245,158,11,.08)] shadow-[0_0_0_1px_rgba(245,158,11,.35),0_8px_28px_rgba(245,158,11,.18)]`
      : `${base} border-[rgba(139,92,246,.75)] bg-[rgba(139,92,246,.1)] shadow-[0_0_0_1px_rgba(139,92,246,.35),0_8px_28px_rgba(139,92,246,.2)]`
  }
  return kind === 'weekly'
    ? `${base} border-[rgba(245,158,11,.22)] hover:border-[rgba(245,158,11,.5)] hover:bg-[var(--wm-surface)]`
    : `${base} border-[rgba(139,92,246,.22)] hover:border-[rgba(139,92,246,.5)] hover:bg-[var(--wm-surface)]`
}

export default function EnglishWeeklyPlanSession({ vocab, stage }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const { masteryMap } = useWordsContext()
  const {
    allPlans,
    weeklyPlan,
    isLoading: weeklyLoading,
  } = useWeeklyPlan(user)
  const {
    plans: adaptivePlans,
    isLoading: adaptiveLoading,
    loadProgressForPlans,
  } = useAdaptiveWordPlan(user)
  const [showOldReview, setShowOldReview] = useState(false)
  const [dayByPlanId, setDayByPlanId] = useState<Record<string, PlanDaySnapshot>>({})
  const [rowsByPlanId, setRowsByPlanId] = useState<Record<string, AdaptivePlanWordProgress[]>>({})

  const stageWordKeys = useMemo(() => new Set(vocab.map(wordKey)), [vocab])
  const stageLessonKeys = useMemo(
    () => new Set(vocab.map((word) => `${word.unit}::${word.lesson}`)),
    [vocab],
  )

  const visibleWeeklyPlans = useMemo(
    () => allPlans.filter((plan) => weeklyPlanMatchesStage(plan, stageWordKeys)),
    [allPlans, stageWordKeys],
  )

  const visibleWeeklyPlan = useMemo(
    () =>
      weeklyPlan && weeklyPlanMatchesStage(weeklyPlan, stageWordKeys) ? weeklyPlan : null,
    [weeklyPlan, stageWordKeys],
  )

  const visibleAdaptivePlans = useMemo(
    () =>
      adaptivePlans.filter(
        (plan) =>
          (plan.status === 'active' || plan.status === 'completed') &&
          adaptivePlanMatchesStage(plan, stage, stageLessonKeys),
      ),
    [adaptivePlans, stage, stageLessonKeys],
  )

  const activeAdaptive = useMemo(
    () => visibleAdaptivePlans.find((plan) => plan.status === 'active') ?? null,
    [visibleAdaptivePlans],
  )

  /** Prefer this week's multi-day plan; otherwise the active adaptive plan. */
  const currentActiveKey = useMemo(() => {
    if (visibleWeeklyPlan && isWeeklyIncomplete(visibleWeeklyPlan)) {
      return `weekly:${visibleWeeklyPlan.id ?? visibleWeeklyPlan.weekStart}`
    }
    if (activeAdaptive) return `adaptive:${activeAdaptive.id}`
    if (visibleWeeklyPlan) {
      return `weekly:${visibleWeeklyPlan.id ?? visibleWeeklyPlan.weekStart}`
    }
    return null
  }, [visibleWeeklyPlan, activeAdaptive])

  const unifiedCards = useMemo(() => {
    const cards: UnifiedPlanCard[] = []

    for (const plan of visibleWeeklyPlans) {
      cards.push({
        key: `weekly:${plan.id ?? plan.weekStart}`,
        kind: 'weekly',
        incomplete: isWeeklyIncomplete(plan),
        sortDate: plan.weekStart,
        weekly: plan,
      })
    }

    for (const plan of visibleAdaptivePlans) {
      cards.push({
        key: `adaptive:${plan.id}`,
        kind: 'adaptive',
        incomplete: plan.status === 'active',
        sortDate: plan.updatedAt.slice(0, 10),
        adaptive: plan,
      })
    }

    cards.sort((a, b) => {
      const aCurrent = a.key === currentActiveKey ? 0 : 1
      const bCurrent = b.key === currentActiveKey ? 0 : 1
      if (aCurrent !== bCurrent) return aCurrent - bCurrent
      if (a.incomplete !== b.incomplete) return a.incomplete ? -1 : 1
      return b.sortDate.localeCompare(a.sortDate)
    })

    return cards
  }, [visibleWeeklyPlans, visibleAdaptivePlans, currentActiveKey])

  const currentAndNextWeekPlans = useMemo(() => {
    const today = todayStr()
    const sorted = [...visibleWeeklyPlans].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    )
    let currentIdx = -1
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].weekStart <= today) {
        currentIdx = i
        break
      }
    }
    const result: WeeklyPlan[] = []
    if (currentIdx >= 0) result.push(sorted[currentIdx])
    if (currentIdx + 1 < sorted.length) result.push(sorted[currentIdx + 1])
    return result
  }, [visibleWeeklyPlans])

  const oldReviewWords = useMemo(
    () => getOldReviewWords(vocab, masteryMap, currentAndNextWeekPlans),
    [vocab, masteryMap, currentAndNextWeekPlans],
  )

  const activeAdaptiveIds = useMemo(
    () => visibleAdaptivePlans.filter((p) => p.status === 'active').map((p) => p.id),
    [visibleAdaptivePlans],
  )

  useEffect(() => {
    if (activeAdaptiveIds.length === 0) {
      setDayByPlanId({})
      setRowsByPlanId({})
      return
    }

    let cancelled = false
    const today = todayStr()
    const activePlans = visibleAdaptivePlans.filter((p) => p.status === 'active')

    void loadProgressForPlans(activeAdaptiveIds)
      .then((rowsMap) => {
        if (cancelled) return
        const entries = activePlans.map((plan) => {
          const rows = rowsMap[plan.id] ?? []
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
        setRowsByPlanId(rowsMap)
      })
      .catch((err) => {
        console.error('[adaptive_word_plan] practice list progress load failed', err)
      })

    return () => {
      cancelled = true
    }
  }, [activeAdaptiveIds, loadProgressForPlans, visibleAdaptivePlans])

  if (showOldReview) {
    return (
      <OldReviewSession
        words={oldReviewWords}
        vocab={vocab}
        onBack={() => setShowOldReview(false)}
      />
    )
  }

  if (weeklyLoading || adaptiveLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--wm-text-dim)]">
        加载中…
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-4 pt-5 pb-3">
        <div className="rounded-[20px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="font-fredoka bg-gradient-to-br from-[#f59e0b] via-[#fb923c] to-[#8b5cf6] bg-clip-text text-2xl text-transparent">
              练习计划
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {oldReviewWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOldReview(true)}
                  className="font-nunito flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.08)] px-4 py-2.5 text-[.88rem] font-extrabold text-[#c4b5fd] transition-all hover:border-[rgba(167,139,250,.7)] hover:bg-[rgba(167,139,250,.15)]"
                >
                  📚 旧词复习
                  <span className="rounded-full bg-[rgba(167,139,250,.25)] px-1.5 py-0.5 text-[.72rem] font-black text-[#a78bfa]">
                    {oldReviewWords.length}
                  </span>
                </button>
              )}
              <Link
                href="/admin/plans/english"
                className="font-nunito rounded-[10px] border border-[rgba(96,165,250,.35)] bg-[rgba(96,165,250,.08)] px-3 py-2.5 text-[.75rem] font-extrabold text-[#93c5fd] no-underline"
              >
                计划管理
              </Link>
            </div>
          </div>

          {unifiedCards.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--wm-text-dim)]">
              <div className="flex flex-col items-center gap-3">
                <span>暂无练习计划</span>
                <span className="text-[.75rem]">请家长在管理后台创建多日计划或自适应计划</span>
                <Link
                  href="/admin/plans/english"
                  className="font-nunito rounded-[10px] border border-[rgba(96,165,250,.4)] bg-[rgba(96,165,250,.08)] px-4 py-2 text-[.8rem] font-extrabold text-[#93c5fd] no-underline"
                >
                  前往计划管理
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {unifiedCards.map((card) => {
                const isCurrent = card.key === currentActiveKey
                if (card.kind === 'weekly' && card.weekly) {
                  return (
                    <WeeklyPlanCard
                      key={card.key}
                      plan={card.weekly}
                      isCurrent={isCurrent}
                      onOpen={() => {
                        if (card.weekly?.id) router.push(`/english/words/weekly/${card.weekly.id}`)
                      }}
                    />
                  )
                }
                if (card.kind === 'adaptive' && card.adaptive) {
                  return (
                    <AdaptivePlanCard
                      key={card.key}
                      plan={card.adaptive}
                      isCurrent={isCurrent}
                      daySnapshot={dayByPlanId[card.adaptive.id]}
                      rows={rowsByPlanId[card.adaptive.id]}
                      vocab={vocab}
                      onOpen={() => router.push(`/english/words/adaptive/${card.adaptive!.id}`)}
                    />
                  )
                }
                return null
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

function WeeklyPlanCard({
  plan,
  isCurrent,
  onOpen,
}: {
  plan: WeeklyPlan
  isCurrent: boolean
  onOpen: () => void
}) {
  const doneDays = plan.days.filter((d) => plan.progress[d.date]?.quizDone === true).length
  const showWeekExpiry = !plan.weekCompletion
  const totalDays = planDayCount(plan)
  const remaining = showWeekExpiry ? daysUntilExpiry(planEndDate(plan)) : 0
  const isExpired = showWeekExpiry && remaining < 0
  const weekEnd = planEndDate(plan)
  const lessonLabel = formatPlanLessonLabel(plan.unit, plan.lesson)

  return (
    <div className={cardShellClass('weekly', isCurrent)}>
      <button
        type="button"
        onClick={onOpen}
        className="min-h-0 min-w-0 flex-1 cursor-pointer rounded-t-[16px] px-4 py-4 text-left"
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.12)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#fbbf24]">
            多日计划
          </span>
          {isCurrent && (
            <span className="rounded-full border border-[rgba(245,158,11,.55)] bg-[rgba(245,158,11,.22)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#fcd34d] shadow-[0_0_12px_rgba(245,158,11,.25)]">
              当前 · 需练习
            </span>
          )}
          {plan.weekCompletion && (
            <span className="rounded-full border border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.1)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#86efac]">
              已结课
            </span>
          )}
        </div>
        <div className="mb-1 text-[1rem] font-bold leading-snug text-[var(--wm-text)]">
          {lessonLabel}
        </div>
        <div className="flex flex-col gap-1 text-[.72rem] text-[var(--wm-text-dim)]">
          <span>
            {fmtDate(plan.weekStart)} – {fmtDate(weekEnd)}
          </span>
          <span>
            {doneDays}/{totalDays} 天完成
            {showWeekExpiry && (
              <span className={`ml-2 ${isExpired ? 'text-[#f87171]' : 'text-[#fbbf24]'}`}>
                {isExpired ? `已过期 ${Math.abs(remaining)} 天` : `还剩 ${remaining} 天`}
              </span>
            )}
          </span>
        </div>
      </button>
      <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 px-4 pb-4">
        {plan.weekCompletion && plan.id && (
          <Link
            href={`/english/words/weekly/${plan.id}/report`}
            className="font-nunito inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-[var(--wm-border)] bg-[var(--wm-surface)] px-2.5 py-2 text-center text-[.72rem] font-extrabold whitespace-nowrap text-[#c4b5fd] transition-all hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.12)]"
          >
            结课报告
          </Link>
        )}
        {plan.id && (
          <Link
            href={`/english/words/weekly/${plan.id}`}
            className={`font-nunito rounded-[10px] border px-2.5 py-2 text-[.72rem] font-extrabold whitespace-nowrap no-underline ${
              isCurrent
                ? 'border-[rgba(245,158,11,.55)] bg-[rgba(245,158,11,.2)] text-[#fcd34d]'
                : 'border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.1)] text-[#fbbf24]'
            }`}
          >
            开始练习 →
          </Link>
        )}
      </div>
    </div>
  )
}

function AdaptivePlanCard({
  plan,
  isCurrent,
  daySnapshot,
  rows,
  vocab,
  onOpen,
}: {
  plan: AdaptiveWordPlan
  isCurrent: boolean
  daySnapshot: PlanDaySnapshot | undefined
  rows: AdaptivePlanWordProgress[] | undefined
  vocab: WordEntry[]
  onOpen: () => void
}) {
  const capsules =
    plan.status === 'active' && daySnapshot && rows
      ? buildDailyWordCapsules(daySnapshot.dailyTask, rows, vocab)
      : []

  return (
    <div className={cardShellClass('adaptive', isCurrent)}>
      <button
        type="button"
        onClick={onOpen}
        className="min-h-0 min-w-0 w-full flex-1 cursor-pointer rounded-t-[16px] px-4 py-4 text-left"
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[rgba(139,92,246,.4)] bg-[rgba(139,92,246,.12)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#c4b5fd]">
            自适应计划
          </span>
          {isCurrent && (
            <span className="rounded-full border border-[rgba(139,92,246,.55)] bg-[rgba(139,92,246,.22)] px-2 py-0.5 text-[.62rem] font-extrabold text-[#ddd6fe] shadow-[0_0_12px_rgba(139,92,246,.25)]">
              当前 · 需练习
            </span>
          )}
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
        <div className="mb-1 text-[1rem] font-bold leading-snug text-[var(--wm-text)]">
          {plan.title}
        </div>
        <div className="flex flex-col gap-1 text-[.72rem] text-[var(--wm-text-dim)]">
          <span>
            每日新词 {plan.newWordsPerDay} · 复习上限 {plan.reviewCap}
          </span>
          {plan.status === 'active' && daySnapshot && (
            <span>
              已掌握 {daySnapshot.mastered}/{daySnapshot.total} · 今日新学{' '}
              {daySnapshot.dailyTask.activateKeys.length} · 复习{' '}
              {daySnapshot.dailyTask.reviewKeys.length}
            </span>
          )}
        </div>
        {plan.status === 'active' && (
          <div className="mt-2.5">
            {!daySnapshot || !rows ? (
              <div className="text-[.72rem] text-[var(--wm-text-dim)]">加载今日单词…</div>
            ) : capsules.length === 0 ? (
              <div className="text-[.72rem] text-[var(--wm-text-dim)]">今日暂无待练单词</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {capsules.slice(0, 8).map((capsule) => (
                  <span
                    key={capsule.wordKey}
                    className={`inline-flex items-center rounded-2xl border-[1.5px] px-2 py-0.5 text-[0.78rem] font-bold leading-tight ${CAPSULE_KIND_CLASS[capsule.kind]}`}
                  >
                    <span className="mr-1 text-[.7rem] leading-none">{capsule.boxEmoji}</span>
                    {capsule.word}
                  </span>
                ))}
                {capsules.length > 8 && (
                  <span className="text-[.7rem] font-bold text-[var(--wm-text-dim)]">
                    +{capsules.length - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </button>
      <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 px-4 pb-4">
        <Link
          href={`/english/words/adaptive/${plan.id}/preview`}
          className="font-nunito rounded-[10px] border border-[rgba(139,92,246,.35)] bg-[rgba(139,92,246,.1)] px-2.5 py-2 text-[.72rem] font-extrabold whitespace-nowrap text-[#c4b5fd] no-underline"
        >
          轨迹预览
        </Link>
        <Link
          href={`/english/words/adaptive/${plan.id}`}
          className={`font-nunito rounded-[10px] border px-2.5 py-2 text-[.72rem] font-extrabold whitespace-nowrap no-underline ${
            isCurrent
              ? 'border-[rgba(139,92,246,.55)] bg-[rgba(139,92,246,.22)] text-[#ddd6fe]'
              : 'border-[rgba(139,92,246,.35)] bg-[rgba(139,92,246,.1)] text-[#c4b5fd]'
          }`}
        >
          开始练习 →
        </Link>
      </div>
    </div>
  )
}
