'use client'

import { useEffect, useMemo, useState } from 'react'
import { todayStr, useAuth } from '@rosie/core'
import { useWeeklyPlan, useAdaptiveTodayProgress } from '@rosie/english'
import { useMathWeeklyPlan } from '@rosie/math-kit/hooks/useMathWeeklyPlan'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'
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
import { buildTodayPlanCards, TodayPlanOverviewCards } from './TodayPlanOverview'
import TodayProgressBackup from './TodayProgressBackup'
import { useAdaptiveDailyHistory } from './useAdaptiveDailyHistory'
import { NavigationLink, RotateCw } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'
import { useOfflinePreparation } from '@/components/offline/OfflinePreparation'

export function useTodayPlanOverview(date?: string) {
  const { user } = useAuth()
  const { weeklyPlan: englishPlan, isLoading: englishLoading } = useWeeklyPlan(user)
  const {
    activePlan: activeAdaptive,
    summary: adaptiveToday,
    isLoading: adaptiveLoading,
  } = useAdaptiveTodayProgress(user)
  const { weeklyPlan: mathPlan, isLoading: mathLoading } = useMathWeeklyPlan(user)
  // `today` may be a historical date picked on the plan-calendar page; calc
  // stats are per-date, but live coins / adaptive summary are today-only.
  const today = date ?? todayStr()
  const isActualToday = today === todayStr()
  const calcDaily = useCalcDaily(user, today)
  const { history: adaptiveHistory, isLoading: adaptiveHistoryLoading } = useAdaptiveDailyHistory(
    user,
    !isActualToday && activeAdaptive ? activeAdaptive.id : null,
  )
  const adaptiveHistoryRow = adaptiveHistory?.get(today) ?? null
  const overviewAdaptive = isActualToday || adaptiveHistoryRow ? activeAdaptive : null
  const chinese = useChineseRoadmapProgress(user)
  const {
    activePlan: chineseActivePlan,
    completedPlan: chineseCompletedPlan,
    loadRunsForPlan,
    runsByPlanId,
    isLoading: chinesePlanLoading,
  } = useChineseRoadmapPlan(user)
  const chinesePlanCleared = !chineseActivePlan && !!chineseCompletedPlan

  const chineseFocusPlan = chineseActivePlan ?? chineseCompletedPlan
  useEffect(() => {
    if (chineseFocusPlan) void loadRunsForPlan(chineseFocusPlan.id)
  }, [chineseFocusPlan, loadRunsForPlan])

  useEffect(() => {
    if (chineseActivePlan) setActiveChineseBook(chineseActivePlan.bookSlug)
    else if (chineseCompletedPlan) setActiveChineseBook(chineseCompletedPlan.bookSlug)
  }, [chineseActivePlan, chineseCompletedPlan])

  const englishToday = englishPlan?.days.find((d) => d.date === today)
  const englishProgress = englishPlan?.progress[today]
  const newWordKeys = englishToday?.newWordKeys ?? []
  const englishDone = !!englishProgress?.quizDone

  // Math: today's required problems
  const mathToday = mathPlan?.days.find((d) => d.date === today)
  const mathProgress = mathPlan?.progress[today] ?? { doneKeys: [] }
  const mathProblems = mathToday?.problems ?? []
  const mathDoneCount = mathProblems.filter((p) =>
    isPlanProblemDone(p, today, mathProgress.doneKeys),
  ).length
  const mathAllDone = mathProblems.length > 0 && mathDoneCount >= mathProblems.length

  const chineseOrderedKeys = useMemo(
    () => orderedPlanLessonKeys(chinese.lessons, chineseActivePlan?.bookSlug ?? chinese.bookSlug),
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
    return chinese.lessons.find((l) => l.lessonKey === chineseActivePlan.currentLessonKey) ?? null
  }, [chineseActivePlan, chinese.lessons])

  // Today's Chinese run: boolean check — has any run been recorded today?
  const chineseTodayRun = useMemo(() => {
    if (!chineseFocusPlan) return null
    const runs = runsByPlanId[chineseFocusPlan.id] ?? []
    return runs.find((r) => r.finishedAt.startsWith(today)) ?? null
  }, [chineseFocusPlan, runsByPlanId, today])
  const chineseHasTodayRun = chineseTodayRun !== null

  const chineseDone = chineseActivePlan
    ? chineseHasTodayRun
    : chinesePlanCleared || chinese.allDone || chinese.lessonDone
  const chinesePct = chineseActivePlan
    ? chineseHasTodayRun
      ? 100
      : 0
    : chinesePlanCleared
      ? 100
      : chinese.total > 0
        ? Math.round((chinese.done / chinese.total) * 100)
        : chinese.allDone
          ? 100
          : 0

  const chinesePracticeHref = chineseActivePlan && chineseBatchKeys.length > 0
    ? buildChinesePlanPracticeHref(chineseActivePlan, chineseBatchKeys)
    : undefined
  const chineseHref = chinesePlanCleared
    ? '/chinese/weekly'
    : chineseActivePlan && chineseHasTodayRun
      ? '/chinese/weekly'
      : chinesePracticeHref
        ? chinesePracticeHref
        : chinese.currentNode
          ? `${chineseRoute(chinese.bookSlug, 'chars/practice')}?lessons=${encodeURIComponent(chinese.currentNode.lessonKey)}`
          : chineseRoute(chinese.bookSlug, 'daily')

  const chineseRunLesson = chineseTodayRun
    ? (chinese.lessons.find((l) => l.lessonKey === chineseTodayRun.lessonKey) ?? null)
    : null
  const chineseSubtitle = chinesePlanCleared
    ? '计划通关 🎉'
    : chineseActivePlan
      ? chineseHasTodayRun
        ? `${chineseRunLesson?.lessonTitle ?? chineseTodayRun!.lessonKey} 已完成`
        : `${chinesePlanLesson?.lessonTitle ?? chineseActivePlan.currentLessonKey} · ${formatPlanQuizTypes(chineseActivePlan.quizTypes)}`
      : chinese.allDone
        ? '本册通关 🎉'
        : chinese.lessonDone
          ? '本关完成 🎉'
          : (chinese.currentNode?.lessonTitle ?? '当前关卡')

  const loadingHistory = !isActualToday && !!activeAdaptive && adaptiveHistoryLoading
  const subjectLoading = {
    calc: calcDaily.isLoading,
    english: englishLoading || (isActualToday && adaptiveLoading) || loadingHistory,
    math: mathLoading,
    chinese: chinesePlanLoading || (chinese.isCharDataLoading && !chinese.isCharDataReady),
  }

  const hasMath = mathPlan && mathProblems.length > 0
  const hasEnglish = !!(englishPlan && newWordKeys.length > 0) || !!overviewAdaptive
  // 英语单词预习区只跟随周计划：无周计划（或今日无词）时整块隐藏，
  // 自适应计划由下方 AdaptivePlanTodayCard 独立展示（无计划时自身返回 null）。
  const hasWeeklyEnglish = !!(englishPlan && newWordKeys.length > 0)
  const hasChinese = !!chineseActivePlan || chinesePlanCleared || chinese.hasChinese
  const calcDoneCount = calcDaily.todayDone
  const calcTargetCount = calcDaily.todayTarget
  const calcAllDone = calcDoneCount >= calcTargetCount && calcTargetCount > 0
  const calcAccuracy =
    calcDoneCount > 0 ? Math.round((calcDaily.todayCorrect / calcDoneCount) * 100) : 0

  // Active adaptive wins over weekly.
  // Done today → detail/hub; incomplete → practice.
  const englishPlanHref = overviewAdaptive
    ? `/english/words/adaptive/${overviewAdaptive.id}`
    : englishPlan?.id
      ? `/english/words/weekly/${englishPlan.id}`
      : undefined
  const englishPracticeHref = englishPlanHref && `${englishPlanHref}/practice`
  const englishPlanDone = overviewAdaptive ? adaptiveToday?.allDone : englishDone
  const englishHref = (englishPlanDone ? englishPlanHref : englishPracticeHref) ?? '/english/words/daily'

  const allOverviewCards = buildTodayPlanCards({
    calc: {
      done: calcDoneCount,
      target: calcTargetCount,
      coins: isActualToday ? calcDaily.todayCoins : 0,
      accuracy: calcAccuracy,
      allDone: calcAllDone,
      href: '/calc/session?mode=daily&start=1',
    },
    english: {
      doneCount: overviewAdaptive
        ? isActualToday
          ? (adaptiveToday?.done ?? 0)
          : (adaptiveHistoryRow?.newDone ?? 0) + (adaptiveHistoryRow?.reviewDone ?? 0)
        : englishDone
          ? newWordKeys.length
          : 0,
      total: overviewAdaptive
        ? isActualToday
          ? (adaptiveToday?.total ?? overviewAdaptive.newWordsPerDay)
          : (adaptiveHistoryRow?.newGoal ?? 0) + (adaptiveHistoryRow?.reviewGoal ?? 0)
        : newWordKeys.length,
      lastScore: overviewAdaptive ? undefined : englishProgress?.lastScore,
      allDone: overviewAdaptive
        ? isActualToday
          ? (adaptiveToday?.allDone ?? false)
          : (adaptiveHistoryRow?.allDone ?? false)
        : englishDone,
      href: englishHref,
      resumeHref: englishPracticeHref,
      subtitle: overviewAdaptive
        ? isActualToday
          ? adaptiveToday
            ? `自适应 · ${adaptiveToday.subtitle}`
            : `自适应 · 每日约 ${overviewAdaptive.newWordsPerDay} 词`
          : adaptiveHistoryRow
            ? `自适应 · 新学 ${adaptiveHistoryRow.newDone}/${adaptiveHistoryRow.newGoal} · 复习 ${adaptiveHistoryRow.reviewDone}/${adaptiveHistoryRow.reviewGoal}`
            : undefined
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
            ? chineseHasTodayRun
              ? '✓'
              : ''
            : chinese.done,
      total:
        chinesePlanCleared || (!chineseActivePlan && chinese.allDone)
          ? null
          : chineseActivePlan
            ? null
            : chinese.total,
      subtitle: chineseSubtitle,
      pct: chinesePct,
      allDone: chineseDone,
      href: chineseHref,
      resumeHref: chinesePracticeHref,
    },
  })

  const subjectHasPlan = {
    calc: true,
    english: hasEnglish,
    math: !!hasMath,
    chinese: hasChinese,
  }
  const overviewCards = allOverviewCards.map((card) => {
    if (subjectLoading[card.key]) {
      return {
        ...card,
        href: subjectHasPlan[card.key] ? card.href : null,
        done: null,
        total: null,
        subtitle: '正在读取进度…',
        pct: 0,
      }
    }
    if (subjectHasPlan[card.key]) return card
    const hasWeeklyPlan =
      (card.key === 'english' && englishPlan) || (card.key === 'math' && mathPlan)
    const subtitle = hasWeeklyPlan ? '当天没有安排练习' : '暂无计划'
    return { ...card, href: null, done: '', total: null, subtitle, pct: 0 }
  })

  const loadingDetails = englishLoading || mathLoading || subjectLoading.chinese || loadingHistory
  return {
    today,
    isActualToday,
    overviewCards,
    offlineReady: !Object.values(subjectLoading).some(Boolean),
    loadingDetails,
    englishPlan,
    englishProgress,
    englishDone,
    newWordKeys,
    hasWeeklyEnglish,
    hasEnglish,
    mathProblems,
    mathPlanId: mathPlan?.weekStart,
    mathProgress,
    mathAllDone,
    hasMath,
    chineseHref,
    chineseActivePlan,
    chineseCompletedPlan,
    chineseTodayRun,
    chineseHasTodayRun,
    chineseRunLesson,
    chineseFocusPlan,
    calcAllDone,
    calcDoneCount,
    calcTargetCount,
    calcAccuracy,
    calcDaily,
  }
}

export default function TodayPlanSummary() {
  const { today, overviewCards, offlineReady, englishPlan, mathPlanId, mathProblems, mathProgress } = useTodayPlanOverview()
  const [resetToast, setResetToast] = useState<string | null>(null)
  const offline = useOfflinePreparation({
    day: today, cards: overviewCards, englishPlan, mathPlanId,
    math: mathProblems, mathDone: mathProgress.doneKeys,
  }, offlineReady)

  useEffect(() => {
    if (!resetToast) return
    const timer = window.setTimeout(() => setResetToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [resetToast])

  return <>
    <TodayProgressBackup renderHeader={(backupButton) => (
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="home-today-title" className="text-text-primary text-sm font-bold">今日计划</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {backupButton}
          <Button size="1" variant="ghost" color="gray" disabled={!offline.canSync} onClick={offline.sync}>
            <RotateCw size={14} aria-hidden="true" className={offline.busy ? 'motion-safe:animate-spin' : undefined} />
            {offline.busy ? '离线同步中…' : '离线同步'}
          </Button>
          <NavigationLink href="/today" aria-label="查看全部计划"
            className="text-text-secondary inline-flex items-center gap-1 text-sm font-bold">
            全部 <span aria-hidden="true">›</span>
          </NavigationLink>
        </div>
      </div>
    )} />
    {resetToast && (
      <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
        role="status">
        {resetToast}
      </p>
    )}
    <TodayPlanOverviewCards cards={overviewCards} linkable showProgressPercent allowReset onResetToast={setResetToast} />
    {(offline.saved || offline.error) && <p className="text-text-secondary mt-2 text-xs" role="status">
      {[offline.saved, offline.error].filter(Boolean).join(' · ')}
    </p>}
  </>
}
