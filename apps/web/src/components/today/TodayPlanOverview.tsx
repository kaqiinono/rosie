'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAuth, todayStr } from '@rosie/core'
import { useWeeklyPlan, useWordData } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math/hooks/useMathWeeklyPlan'
import { useCalcDaily } from '@rosie/calc'
import {
  ChineseProvider,
  useChineseContext,
  buildChineseRoadmap,
  chineseRoute,
} from '@rosie/chinese'
import type { WordEntry } from '@rosie/core'

function wordKeyStr(e: WordEntry): string {
  return `${e.unit}::${e.lesson}::${e.word}`
}

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
  }
  english: {
    doneCount: number
    total: number
    lastScore?: number
    allDone: boolean
    href: string
  }
  math: {
    done: number
    total: number
    allDone: boolean
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
      href: `/calc?count=${calc.target}`,
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
        ? `得分 ${english.lastScore ?? 0}% 🎉`
        : `${english.total} 个新词待学`,
      pct: english.allDone ? 100 : 0,
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
      href: '/math/ny/plan',
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

export function TodayPlanOverviewCards({
  cards,
  linkable = false,
  className,
}: TodayPlanOverviewCardsProps) {
  return (
    <div className={className ?? 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
      {cards.map((card) => {
        const body = (
          <>
            <div className="absolute -right-2 -top-2 text-3xl opacity-15">{card.icon}</div>
            <div
              className="mb-1 text-[11px] font-bold tracking-widest uppercase"
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

function useChineseRoadmapProgress() {
  const {
    lessons,
    lessonGroups,
    masteryMap,
    isCharDataReady,
    isCharDataLoading,
    bookSlug,
  } = useChineseContext()

  const roadmap = useMemo(
    () => (isCharDataReady ? buildChineseRoadmap(lessons, lessonGroups, masteryMap, bookSlug) : null),
    [isCharDataReady, lessons, lessonGroups, masteryMap, bookSlug],
  )
  const currentNode = roadmap?.nodes.find((n) => n.state === 'current') ?? null
  const allDone = isCharDataReady && !currentNode
  const done = currentNode?.status.correct ?? 0
  const total = currentNode?.status.total ?? 0
  const lessonDone = total > 0 && done >= total

  return {
    bookSlug,
    isCharDataLoading,
    isCharDataReady,
    currentNode,
    allDone,
    done,
    total,
    lessonDone,
    hasChinese: isCharDataReady,
  }
}

/** Must be used under ChineseProvider. */
export function useTodayPlanOverview() {
  const { user } = useAuth()
  const { weeklyPlan: englishPlan, isLoading: englishLoading } = useWeeklyPlan(user)
  const { weeklyPlan: mathPlan, isLoading: mathLoading } = useMathWeeklyPlan(user)
  const { vocab } = useWordData(user)
  const calcDaily = useCalcDaily(user)
  const chinese = useChineseRoadmapProgress()

  const today = todayStr()

  const englishToday = englishPlan?.days.find((d) => d.date === today)
  const englishProgress = englishPlan?.progress[today]
  const newWordKeys = englishToday?.newWordKeys ?? []
  const vocabByKey = Object.fromEntries(vocab.map((w) => [wordKeyStr(w), w]))
  const todayWords = newWordKeys.map((k) => vocabByKey[k]).filter(Boolean) as WordEntry[]
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

  const isLoading =
    englishLoading || mathLoading || (chinese.isCharDataLoading && !chinese.isCharDataReady)

  const cards = buildTodayPlanCards({
    calc: {
      done: calcDoneCount,
      target: calcTargetCount,
      coins: calcDaily.todayCoins,
      accuracy: calcAccuracy,
      allDone: calcAllDone,
    },
    english: {
      doneCount: englishDone ? todayWords.length : 0,
      total: todayWords.length,
      lastScore: englishProgress?.lastScore,
      allDone: englishDone,
      href: englishPlan?.id ? `/english/words/weekly/${englishPlan.id}` : '/english/words/daily',
    },
    math: {
      done: mathDoneCount,
      total: mathProblems.length,
      allDone: mathAllDone,
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
      href: chineseRoute(chinese.bookSlug, 'daily'),
    },
  })

  return {
    isLoading,
    cards,
    hasMath: !!(mathPlan && mathProblems.length > 0),
    hasEnglish: !!(englishPlan && newWordKeys.length > 0),
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

/** Self-contained overview (wraps ChineseProvider) — for homepage. */
export default function TodayPlanOverview(props: TodayPlanOverviewInnerProps) {
  return (
    <ChineseProvider>
      <TodayPlanOverviewInner {...props} />
    </ChineseProvider>
  )
}
