'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  useAuth,
  todayStr,
  getTodayPlanSyncStatus,
  clearTodayPlanSubjectPending,
  PRACTICE_PENDING_CHANGED_EVENT,
  type TodayPlanSubjectKey,
  type TodayPlanSyncStatus,
} from '@rosie/core'
import { useWeeklyPlan, useAdaptiveTodayProgress } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useCalcDaily } from '@rosie/calc'
import {
  useChineseRoadmapProgress,
  useChineseRoadmapPlan,
  chineseRoute,
  setActiveChineseBook,
  buildChinesePlanPracticeHref,
  currentBatchLessonKeys,
  orderedPlanLessonKeys,
  formatPlanQuizTypes,
} from '@rosie/chinese'

export type TodayPlanCardModel = {
  key: 'calc' | 'english' | 'math' | 'chinese'
  label: string
  icon: string
  href: string
  done: number | string
  total: number | null
  subtitle: string
  pct: number
  tone: {
    idleBg: string
    idleBorder: string
    idleShadow: string
    label: string
    value: string
    subtitle: string
    bar: string
  }
}

const DONE_TONE = {
  idleBg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
  idleBorder: 'rgba(34,197,94,.3)',
  idleShadow: '0 4px 16px rgba(34,197,94,.12)',
  label: '#16a34a',
  value: '#15803d',
  subtitle: '#16a34a',
  bar: '#22c55e',
}

export type BuildTodayPlanCardsInput = {
  calc: {
    done: number
    target: number
    coins: number
    accuracy: number
    allDone: boolean
    href?: string
  }
  english: {
    doneCount: number
    total: number
    lastScore?: number
    allDone: boolean
    href: string
    /** Overrides default 「N 个新词待学」 when set */
    subtitle?: string
  }
  math: {
    done: number
    total: number
    allDone: boolean
    href?: string
  }
  chinese: {
    done: number | string
    total: number | null
    subtitle: string
    pct: number
    allDone: boolean
    href: string
  }
}

/** Shared card models — order: 口算 → 英语 → 数学 → 语文 */
export function buildTodayPlanCards(input: BuildTodayPlanCardsInput): TodayPlanCardModel[] {
  const { calc, english, math, chinese } = input
  return [
    {
      key: 'calc',
      label: '口算',
      icon: '🧮',
      href: calc.href ?? '/calc/session?mode=daily&start=1',
      done: calc.done,
      total: calc.target,
      subtitle: calc.allDone
        ? `🎉 完成 · 得 ${calc.coins}⭐`
        : calc.done > 0
          ? `正确率 ${calc.accuracy}%`
          : '今日还未练习',
      pct: calc.target > 0 ? Math.min(100, (calc.done / calc.target) * 100) : 0,
      tone: calc.allDone
        ? DONE_TONE
        : {
            idleBg: 'linear-gradient(135deg, #f3e8ff, #fae8ff)',
            idleBorder: 'rgba(139,92,246,.25)',
            idleShadow: '0 4px 16px rgba(139,92,246,.1)',
            label: '#7c3aed',
            value: '#8b5cf6',
            subtitle: '#6d28d9',
            bar: '#8b5cf6',
          },
    },
    {
      key: 'english',
      label: '英语',
      icon: '📖',
      href: english.href,
      done: english.doneCount,
      total: english.total,
      subtitle: english.allDone
        ? english.lastScore !== undefined
          ? `得分 ${english.lastScore}% 🎉`
          : (english.subtitle ?? '今日任务已完成 🎉')
        : (english.subtitle ?? `${english.total} 个词待练`),
      pct:
        english.allDone
          ? 100
          : english.total > 0
            ? Math.min(100, (english.doneCount / english.total) * 100)
            : 0,
      tone: english.allDone
        ? DONE_TONE
        : {
            idleBg: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
            idleBorder: 'rgba(16,185,129,.2)',
            idleShadow: '0 4px 16px rgba(16,185,129,.08)',
            label: '#0f766e',
            value: '#0d9488',
            subtitle: '#115e59',
            bar: '#10b981',
          },
    },
    {
      key: 'math',
      label: '数学',
      icon: '📐',
      href: math.href ?? '/math/ny/plan/practice',
      done: math.done,
      total: math.total,
      subtitle: math.allDone ? '全部完成 🎉' : `还剩 ${Math.max(0, math.total - math.done)} 题`,
      pct: math.total > 0 ? (math.done / math.total) * 100 : 0,
      tone: math.allDone
        ? DONE_TONE
        : {
            idleBg: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
            idleBorder: 'rgba(251,146,60,.25)',
            idleShadow: '0 4px 16px rgba(251,146,60,.1)',
            label: '#c2410c',
            value: '#ea580c',
            subtitle: '#9a3412',
            bar: '#f97316',
          },
    },
    {
      key: 'chinese',
      label: '语文',
      icon: '📜',
      href: chinese.href,
      done: chinese.done,
      total: chinese.total,
      subtitle: chinese.subtitle,
      pct: chinese.pct,
      tone: chinese.allDone
        ? DONE_TONE
        : {
            idleBg: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            idleBorder: 'rgba(245,158,11,.25)',
            idleShadow: '0 4px 16px rgba(245,158,11,.1)',
            label: '#b45309',
            value: '#d97706',
            subtitle: '#92400e',
            bar: '#f59e0b',
          },
    },
  ]
}

type TodayPlanOverviewCardsProps = {
  cards: TodayPlanCardModel[]
  linkable?: boolean
  className?: string
  allowReset?: boolean
  onResetToast?: (message: string) => void
}

const SUBJECT_LABEL: Record<TodayPlanSubjectKey, string> = {
  calc: '口算',
  english: '英语',
  math: '数学',
  chinese: '语文',
}

const EMPTY_SYNC: Record<TodayPlanSubjectKey, TodayPlanSyncStatus> = {
  calc: 'none',
  english: 'none',
  math: 'none',
  chinese: 'none',
}

function SyncStatusChip({ status }: { status: TodayPlanSyncStatus }) {
  if (status === 'none') return null
  const unsynced = status === 'unsynced'
  return (
    <span
      className={`pointer-events-none inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
        unsynced
          ? 'border-amber-200/80 bg-amber-50 text-amber-800'
          : 'border-emerald-200/80 bg-emerald-50 text-emerald-800'
      }`}
      title={unsynced ? '本机有未备份进度' : '进行中进度已备份到云端'}
    >
      {unsynced ? '未备份' : '已备份'}
    </span>
  )
}

export function TodayPlanOverviewCards({
  cards,
  linkable = false,
  className,
  allowReset = false,
  onResetToast,
}: TodayPlanOverviewCardsProps) {
  const { user } = useAuth()
  const [syncBySubject, setSyncBySubject] = useState(EMPTY_SYNC)
  const [resettingKey, setResettingKey] = useState<TodayPlanSubjectKey | null>(null)
  const [confirmSubject, setConfirmSubject] = useState<TodayPlanSubjectKey | null>(null)

  const refreshSync = useCallback(() => {
    setSyncBySubject(getTodayPlanSyncStatus())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSync()
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshSync()
    }
    window.addEventListener('storage', refreshSync)
    window.addEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshSync)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('storage', refreshSync)
      window.removeEventListener(PRACTICE_PENDING_CHANGED_EVENT, refreshSync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshSync])

  const openResetConfirm = (subject: TodayPlanSubjectKey, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (resettingKey) return
    setConfirmSubject(subject)
  }

  const closeResetConfirm = () => {
    if (resettingKey) return
    setConfirmSubject(null)
  }

  const confirmReset = async () => {
    if (!confirmSubject || resettingKey) return
    const subject = confirmSubject
    setResettingKey(subject)
    try {
      const { cleared, failed } = await clearTodayPlanSubjectPending(user?.id, subject)
      refreshSync()
      if (failed > 0) {
        onResetToast?.('清除失败，请重试')
      } else if (cleared === 0) {
        onResetToast?.('暂无中途进度')
      }
    } catch {
      onResetToast?.('清除失败，请重试')
    } finally {
      setResettingKey(null)
      setConfirmSubject(null)
    }
  }

  return (
    <>
      <div className={className ?? 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
        {cards.map((card) => {
          const sync = syncBySubject[card.key]
          const showActions = allowReset && sync !== 'none'
          const style = {
            background: card.tone.idleBg,
            border: `1.5px solid ${card.tone.idleBorder}`,
            boxShadow: card.tone.idleShadow,
          }
          const actionBorder = card.tone.idleBorder

          const content = (
            <>
              <div className="pointer-events-none absolute -right-1 -bottom-1 text-3xl opacity-15">
                {card.icon}
              </div>
              <div className="absolute top-1.5 right-1.5 z-[1]">
                <SyncStatusChip status={sync} />
              </div>
              <div
                className={`mb-1 text-[11px] font-bold tracking-widest uppercase ${
                  sync !== 'none' ? 'pr-14' : ''
                }`}
                style={{ color: card.tone.label }}
              >
                {card.label}
              </div>
              <div className="text-[26px] leading-none font-black" style={{ color: card.tone.value }}>
                {card.done}
                {card.total !== null && (
                  <span className="text-[16px] font-semibold opacity-60">/{card.total}</span>
                )}
              </div>
              <div
                className="mt-1 truncate text-[10px] font-medium"
                style={{ color: card.tone.subtitle }}
              >
                {card.subtitle}
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'rgba(0,0,0,.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${card.pct}%`, background: card.tone.bar }}
                />
              </div>
            </>
          )

          const actionCellClass =
            'inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 px-2 py-2 text-[11px] font-bold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60'

          const actionBar = showActions ? (
            <div
              className="relative z-[2] grid grid-cols-2"
              style={{ borderTop: `1px solid ${actionBorder}`, background: 'rgba(255,255,255,.45)' }}
            >
              <Link
                href={card.href}
                className={`${actionCellClass} no-underline`}
                style={{ color: card.tone.value }}
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden>▶</span>
                <span>继续练习</span>
              </Link>
              <button
                type="button"
                title="清除本轮中途进度"
                aria-label={`清除${card.label}中途进度`}
                disabled={resettingKey === card.key}
                onClick={(e) => openResetConfirm(card.key, e)}
                className={`${actionCellClass} cursor-pointer`}
                style={{
                  color: '#be123c',
                  borderLeft: `1px solid ${actionBorder}`,
                }}
              >
                <span aria-hidden>{resettingKey === card.key ? '⏳' : '↺'}</span>
                <span>{resettingKey === card.key ? '清除中…' : '清除进度'}</span>
              </button>
            </div>
          ) : null

          // Content-only clickable card when no action strip.
          if (linkable && !showActions) {
            return (
              <Link
                key={card.key}
                href={card.href}
                className="relative block overflow-hidden rounded-2xl px-4 py-3.5 no-underline transition-all hover:-translate-y-0.5"
                style={style}
              >
                {content}
              </Link>
            )
          }

          return (
            <div
              key={card.key}
              className="relative flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-0.5"
              style={style}
            >
              {linkable ? (
                <Link
                  href={card.href}
                  className="relative block flex-1 px-4 py-3.5 no-underline"
                  style={{ color: 'inherit' }}
                >
                  {content}
                </Link>
              ) : (
                <div className="relative flex-1 px-4 py-3.5">{content}</div>
              )}
              {actionBar}
            </div>
          )
        })}
      </div>

      {confirmSubject && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeResetConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-plan-reset-title"
            aria-describedby="today-plan-reset-desc"
            className="w-full max-w-[360px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[15px] font-extrabold tracking-wide text-slate-800" id="today-plan-reset-title">
              清除「{SUBJECT_LABEL[confirmSubject]}」中途进度？
            </div>
            <p className="mb-5 text-[13px] leading-relaxed font-medium text-slate-500" id="today-plan-reset-desc">
              只会丢掉这一轮还没练完的进度，今日已完成的任务不会动。清除后需要重新开始。
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={closeResetConfirm}
                disabled={!!resettingKey}
                className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-600 transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
              >
                先留着
              </button>
              <button
                type="button"
                onClick={() => void confirmReset()}
                disabled={!!resettingKey}
                className="inline-flex flex-[1.2] cursor-pointer items-center justify-center rounded-full border border-rose-200/80 bg-rose-50 px-3 py-2.5 text-[13px] font-bold text-rose-700 transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
              >
                {resettingKey ? '清除中…' : '确认清除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function useTodayPlanOverview() {
  const { user } = useAuth()
  const { weeklyPlan: englishPlan, isLoading: englishLoading } = useWeeklyPlan(user)
  const {
    activePlan: activeAdaptive,
    summary: adaptiveToday,
    isLoading: adaptiveLoading,
  } = useAdaptiveTodayProgress(user)
  const { weeklyPlan: mathPlan, isLoading: mathLoading } = useMathWeeklyPlan(user)
  const calcDaily = useCalcDaily(user)
  const chinese = useChineseRoadmapProgress(user)
  const {
    activePlan: chineseActivePlan,
    completedPlan: chineseCompletedPlan,
    isLoading: chinesePlanLoading,
  } = useChineseRoadmapPlan(user)
  const chinesePlanCleared = !chineseActivePlan && !!chineseCompletedPlan

  useEffect(() => {
    if (chineseActivePlan) setActiveChineseBook(chineseActivePlan.bookSlug)
    else if (chineseCompletedPlan) setActiveChineseBook(chineseCompletedPlan.bookSlug)
  }, [chineseActivePlan, chineseCompletedPlan])

  const today = todayStr()

  const englishToday = englishPlan?.days.find((d) => d.date === today)
  const englishProgress = englishPlan?.progress[today]
  const newWordKeys = englishToday?.newWordKeys ?? []
  const englishDone = !!englishProgress?.quizDone

  const mathToday = mathPlan?.days.find((d) => d.date === today)
  const mathProgress = mathPlan?.progress[today] ?? { doneKeys: [] }
  const mathProblems = mathToday?.problems ?? []
  const mathDoneCount = mathProblems.filter((p) => mathProgress.doneKeys.includes(p.key)).length
  const mathAllDone = mathProblems.length > 0 && mathDoneCount >= mathProblems.length

  const chineseOrderedKeys = useMemo(
    () =>
      orderedPlanLessonKeys(
        chinese.lessons,
        chineseActivePlan?.bookSlug ?? chinese.bookSlug,
      ),
    [chinese.lessons, chineseActivePlan?.bookSlug, chinese.bookSlug],
  )
  const chineseBatchKeys = useMemo(() => {
    if (!chineseActivePlan) return []
    return currentBatchLessonKeys(
      chineseOrderedKeys,
      chineseActivePlan.currentLessonKey,
      chineseActivePlan.lessonsPerBatch,
      new Set(chineseActivePlan.completedLessonKeys),
    )
  }, [chineseActivePlan, chineseOrderedKeys])
  const chinesePlanLesson = useMemo(() => {
    if (!chineseActivePlan) return null
    return (
      chinese.lessons.find((l) => l.lessonKey === chineseActivePlan.currentLessonKey) ?? null
    )
  }, [chineseActivePlan, chinese.lessons])

  // Active plan: batch completion vs completed_lesson_keys (not char mastery N/N).
  const chineseBatchDoneCount = useMemo(() => {
    if (!chineseActivePlan || chineseBatchKeys.length === 0) return 0
    const completed = new Set(chineseActivePlan.completedLessonKeys)
    return chineseBatchKeys.filter((k) => completed.has(k)).length
  }, [chineseActivePlan, chineseBatchKeys])

  const chineseDone = chineseActivePlan
    ? chineseBatchKeys.length > 0 && chineseBatchDoneCount >= chineseBatchKeys.length
    : chinesePlanCleared || chinese.allDone || chinese.lessonDone
  const chinesePct = chineseActivePlan
    ? chineseBatchKeys.length > 0
      ? Math.round((chineseBatchDoneCount / chineseBatchKeys.length) * 100)
      : 0
    : chinesePlanCleared
      ? 100
      : chinese.total > 0
        ? Math.round((chinese.done / chinese.total) * 100)
        : chinese.allDone
          ? 100
          : 0

  const calcDoneCount = calcDaily.todayDone
  const calcTargetCount = calcDaily.todayTarget
  const calcAllDone = calcDoneCount >= calcTargetCount && calcTargetCount > 0
  const calcAccuracy =
    calcDoneCount > 0 ? Math.round((calcDaily.todayCorrect / calcDoneCount) * 100) : 0

  // Active adaptive wins over weekly — otherwise a leftover weekly plan keeps the
  // card on /weekly/…/practice even when today's adaptive goal is done.
  // Done today → detail/hub; incomplete → practice.
  const englishHref = activeAdaptive
    ? adaptiveToday?.allDone
      ? `/english/words/adaptive/${activeAdaptive.id}`
      : `/english/words/adaptive/${activeAdaptive.id}/practice`
    : englishPlan?.id
      ? englishDone
        ? `/english/words/weekly/${englishPlan.id}`
        : `/english/words/weekly/${englishPlan.id}/practice`
      : '/english/words/daily'

  const chineseHref = chinesePlanCleared
    ? '/chinese/weekly'
    : chineseActivePlan && chineseBatchKeys.length > 0
      ? buildChinesePlanPracticeHref(chineseActivePlan, chineseBatchKeys)
      : chinese.currentNode
        ? `${chineseRoute(chinese.bookSlug, 'chars/practice')}?lessons=${encodeURIComponent(chinese.currentNode.lessonKey)}`
        : chineseRoute(chinese.bookSlug, 'daily')

  const chineseSubtitle = chinesePlanCleared
    ? '计划通关 🎉'
    : chineseActivePlan
      ? `${chinesePlanLesson?.lessonTitle ?? chineseActivePlan.currentLessonKey} · ${formatPlanQuizTypes(chineseActivePlan.quizTypes)}`
      : chinese.allDone
        ? '本册通关 🎉'
        : chinese.lessonDone
          ? '本关完成 🎉'
          : (chinese.currentNode?.lessonTitle ?? '当前关卡')

  const isLoading =
    englishLoading ||
    mathLoading ||
    chinesePlanLoading ||
    (chinese.isCharDataLoading && !chinese.isCharDataReady) ||
    (!!activeAdaptive && adaptiveLoading)

  const cards = buildTodayPlanCards({
    calc: {
      done: calcDoneCount,
      target: calcTargetCount,
      coins: calcDaily.todayCoins,
      accuracy: calcAccuracy,
      allDone: calcAllDone,
      href: '/calc/session?mode=daily&start=1',
    },
    english: {
      // Prefer plan keys (not vocab-resolved todayWords) so counts stay correct
      // while word library is still hydrating or a key is temporarily missing.
      doneCount: activeAdaptive
        ? (adaptiveToday?.done ?? 0)
        : englishDone
          ? newWordKeys.length
          : 0,
      total: activeAdaptive
        ? (adaptiveToday?.total ?? activeAdaptive.newWordsPerDay)
        : newWordKeys.length,
      lastScore: activeAdaptive ? undefined : englishProgress?.lastScore,
      allDone: activeAdaptive
        ? (adaptiveToday?.allDone ?? false)
        : englishDone,
      href: englishHref,
      subtitle: activeAdaptive
        ? adaptiveToday
          ? `自适应 · ${adaptiveToday.subtitle}`
          : `自适应 · 每日约 ${activeAdaptive.newWordsPerDay} 词`
        : undefined,
    },
    math: {
      done: mathDoneCount,
      total: mathProblems.length,
      allDone: mathAllDone,
      href: mathAllDone ? '/math/ny/plan' : '/math/ny/plan/practice',
    },
    chinese: {
      done:
        chinesePlanCleared || (!chineseActivePlan && chinese.allDone)
          ? '✓'
          : chineseActivePlan
            ? chineseBatchDoneCount
            : chinese.done,
      total:
        chinesePlanCleared || (!chineseActivePlan && chinese.allDone)
          ? null
          : chineseActivePlan
            ? chineseBatchKeys.length
            : chinese.total,
      subtitle: chineseSubtitle,
      pct: chinesePct,
      allDone: chineseDone,
      href: chineseHref,
    },
  })

  return {
    isLoading,
    cards,
    hasMath: !!(mathPlan && mathProblems.length > 0),
    hasEnglish: !!(englishPlan && newWordKeys.length > 0) || !!activeAdaptive,
    hasChinese: !!chineseActivePlan || chinesePlanCleared || chinese.hasChinese,
  }
}

type TodayPlanOverviewInnerProps = {
  linkable?: boolean
  className?: string
  alwaysShow?: boolean
  loadingFallback?: ReactNode
  allowReset?: boolean
  onResetToast?: (message: string) => void
}

function TodayPlanOverviewInner({
  linkable = false,
  className,
  alwaysShow = true,
  loadingFallback = null,
  allowReset = false,
  onResetToast,
}: TodayPlanOverviewInnerProps) {
  const { isLoading, cards, hasMath, hasEnglish, hasChinese } = useTodayPlanOverview()

  if (isLoading) return <>{loadingFallback}</>
  if (!alwaysShow && !(hasMath || hasEnglish || hasChinese)) return null

  return (
    <TodayPlanOverviewCards
      cards={cards}
      linkable={linkable}
      className={className}
      allowReset={allowReset}
      onResetToast={onResetToast}
    />
  )
}

/** Self-contained overview for homepage / today — no full ChineseProvider. */
export default function TodayPlanOverview(props: TodayPlanOverviewInnerProps) {
  return <TodayPlanOverviewInner {...props} />
}
