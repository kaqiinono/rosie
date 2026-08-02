'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  useAuth,
  todayStr,
  getTodayPlanSyncStatus,
  PRACTICE_PENDING_CHANGED_EVENT,
  type TodayPlanSubjectKey,
  type TodayPlanSyncStatus,
} from '@rosie/core'
import { useWeeklyPlan, useAdaptiveTodayProgress } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useCalcDaily } from '@rosie/calc'
import { useChineseRoadmapProgress, chineseRoute } from '@rosie/chinese'

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
      className={`pointer-events-none absolute top-1.5 right-1.5 z-[1] rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide shadow-sm ${
        unsynced
          ? 'bg-amber-500/90 text-white'
          : 'bg-emerald-600/85 text-white'
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
}: TodayPlanOverviewCardsProps) {
  const [syncBySubject, setSyncBySubject] = useState(EMPTY_SYNC)

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

  return (
    <div className={className ?? 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
      {cards.map((card) => {
        const sync = syncBySubject[card.key]
        const body = (
          <>
            <div className="pointer-events-none absolute -right-1 -bottom-1 text-3xl opacity-15">
              {card.icon}
            </div>
            <SyncStatusChip status={sync} />
            <div
              className="mb-1 pr-12 text-[11px] font-bold tracking-widest uppercase"
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

        const style = {
          background: card.tone.idleBg,
          border: `1.5px solid ${card.tone.idleBorder}`,
          boxShadow: card.tone.idleShadow,
        }

        if (linkable) {
          return (
            <Link
              key={card.key}
              href={card.href}
              className="relative block overflow-hidden rounded-2xl px-4 py-3.5 no-underline transition-all hover:-translate-y-0.5"
              style={style}
            >
              {body}
            </Link>
          )
        }

        return (
          <div key={card.key} className="relative overflow-hidden rounded-2xl px-4 py-3.5" style={style}>
            {body}
          </div>
        )
      })}
    </div>
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

  const chineseDone = chinese.allDone || chinese.lessonDone
  const chinesePct =
    chinese.total > 0 ? Math.round((chinese.done / chinese.total) * 100) : chinese.allDone ? 100 : 0

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

  const isLoading =
    englishLoading ||
    mathLoading ||
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
      done: chinese.allDone ? '✓' : chinese.done,
      total: chinese.allDone ? null : chinese.total,
      subtitle: chinese.allDone
        ? '本册通关 🎉'
        : chinese.lessonDone
          ? '本关完成 🎉'
          : (chinese.currentNode?.lessonTitle ?? '当前关卡'),
      pct: chinesePct,
      allDone: chineseDone,
      href: chinese.currentNode
        ? `/chinese/chars/practice?lessons=${encodeURIComponent(chinese.currentNode.lessonKey)}`
        : chineseRoute(chinese.bookSlug, 'daily'),
    },
  })

  return {
    isLoading,
    cards,
    hasMath: !!(mathPlan && mathProblems.length > 0),
    hasEnglish: !!(englishPlan && newWordKeys.length > 0) || !!activeAdaptive,
    hasChinese: chinese.hasChinese,
  }
}

type TodayPlanOverviewInnerProps = {
  linkable?: boolean
  className?: string
  alwaysShow?: boolean
  loadingFallback?: ReactNode
}

function TodayPlanOverviewInner({
  linkable = false,
  className,
  alwaysShow = true,
  loadingFallback = null,
}: TodayPlanOverviewInnerProps) {
  const { isLoading, cards, hasMath, hasEnglish, hasChinese } = useTodayPlanOverview()

  if (isLoading) return <>{loadingFallback}</>
  if (!alwaysShow && !(hasMath || hasEnglish || hasChinese)) return null

  return <TodayPlanOverviewCards cards={cards} linkable={linkable} className={className} />
}

/** Self-contained overview for homepage / today — no full ChineseProvider. */
export default function TodayPlanOverview(props: TodayPlanOverviewInnerProps) {
  return <TodayPlanOverviewInner {...props} />
}
