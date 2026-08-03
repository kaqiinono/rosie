'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@rosie/core'
import { chineseRoute } from '../utils/chinese-routes'
import { getLessonDisplayInfo } from '../utils/chinese-lesson-display'
import { charKey, masteryKey } from '../utils/chinese-helpers'
import { useChineseRoadmapProgress } from '../hooks/useChineseRoadmapProgress'
import { useChineseRoadmapPlan } from '../hooks/useChineseRoadmapPlan'
import { setActiveChineseBook } from '../hooks/useActiveChineseBook'
import {
  buildChinesePlanPracticeHref,
  currentBatchLessonKeys,
  orderedPlanLessonKeys,
} from '../utils/chineseRoadmapPlanLogic'
import { formatPlanQuizTypes } from './plans/chinese-roadmap-plan-shared'

export default function ChineseDailyCard() {
  const { user } = useAuth()
  const {
    lessons,
    masteryMap,
    isCharDataReady,
    isCharDataLoading,
    bookSlug,
    bookLabel,
    currentNode,
    allDone,
    done,
    total,
    lessonDone,
  } = useChineseRoadmapProgress()
  const { activePlan, completedPlan, isLoading: plansLoading } = useChineseRoadmapPlan(user)
  const planCompleted = !activePlan && !!completedPlan
  const focusPlan = activePlan ?? completedPlan

  useEffect(() => {
    if (focusPlan) setActiveChineseBook(focusPlan.bookSlug)
  }, [focusPlan])

  const orderedKeys = useMemo(
    () => orderedPlanLessonKeys(lessons, activePlan?.bookSlug ?? bookSlug),
    [lessons, activePlan?.bookSlug, bookSlug],
  )

  const batchKeys = useMemo(() => {
    if (!activePlan) return []
    return currentBatchLessonKeys(
      orderedKeys,
      activePlan.currentLessonKey,
      activePlan.lessonsPerBatch,
      new Set(activePlan.completedLessonKeys),
    )
  }, [activePlan, orderedKeys])

  const planLesson = useMemo(() => {
    if (!activePlan) return null
    return lessons.find((l) => l.lessonKey === activePlan.currentLessonKey) ?? null
  }, [activePlan, lessons])

  const planDisplay = useMemo(() => {
    if (!planLesson) return null
    return getLessonDisplayInfo(
      planLesson,
      lessons.filter((l) => l.unit === planLesson.unit),
    )
  }, [planLesson, lessons])

  const display = useMemo(() => {
    if (!currentNode) return null
    const lessonRow = lessons.find((l) => l.lessonKey === currentNode.lessonKey)
    return lessonRow
      ? getLessonDisplayInfo(lessonRow, lessons.filter((l) => l.unit === lessonRow.unit))
      : null
  }, [currentNode, lessons])

  const previewChars = useMemo(() => {
    const group = currentNode?.group
    if (!group) return []
    const items: { ch: string; isWrite: boolean; done: boolean }[] = []
    for (const ch of group.recognize) {
      const key = charKey(ch, bookSlug)
      items.push({
        ch,
        isWrite: false,
        done: (masteryMap[masteryKey(key, 'recognize')]?.correct ?? 0) > 0,
      })
    }
    for (const ch of group.write) {
      const key = charKey(ch, bookSlug)
      items.push({
        ch,
        isWrite: true,
        done: (masteryMap[masteryKey(key, 'write')]?.correct ?? 0) > 0,
      })
    }
    return items
  }, [currentNode, masteryMap, bookSlug])

  const planHref =
    activePlan && batchKeys.length > 0
      ? buildChinesePlanPracticeHref(activePlan, batchKeys)
      : null
  const href = planCompleted
    ? '/chinese/weekly'
    : (planHref ?? chineseRoute(bookSlug, 'daily'))
  const isLoading = plansLoading || (isCharDataLoading && !isCharDataReady)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const quizSummary = activePlan ? formatPlanQuizTypes(activePlan.quizTypes) : ''

  return (
    <Link
      href={href}
      onClick={() => {
        if (focusPlan) setActiveChineseBook(focusPlan.bookSlug)
      }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl" />
      <div className="relative px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-lg">📖</span>
            <span className="truncate text-sm font-extrabold text-amber-900">今日任务</span>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {focusPlan ? focusPlan.title || bookLabel : bookLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-600 transition-transform group-hover:translate-x-0.5">
            {(() => {
              if (isLoading) return '…'
              if (planCompleted || (!activePlan && allDone)) return '✅ 通关'
              if (activePlan) return '去练习'
              if (lessonDone) return '继续'
              return '去学习'
            })()}
            <span>→</span>
          </div>
        </div>

        {isLoading ? (
          <div className="h-2 w-full animate-pulse rounded-full bg-amber-100" />
        ) : planCompleted ? (
          <p className="text-xs font-medium text-amber-800/70">
            {completedPlan?.title ? `「${completedPlan.title}」已通关` : '计划已通关'}
            ，可到路线图复习任意一课 ✨
          </p>
        ) : activePlan ? (
          <>
            <p className="text-[11px] font-semibold text-amber-700">
              {planLesson
                ? `第${planLesson.unit}单元 · ${planDisplay?.label ?? planLesson.lessonTitle}`
                : '当前计划'}
            </p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">
              {planLesson?.lessonTitle ?? activePlan.currentLessonKey}
            </p>
            <p className="mt-1 truncate text-[11px] font-medium text-amber-700/80">{quizSummary}</p>
            {batchKeys.length > 1 && (
              <p className="mt-1 text-[10px] font-semibold text-amber-600">
                本批 {batchKeys.length} 关
              </p>
            )}
          </>
        ) : allDone ? (
          <p className="text-xs font-medium text-amber-800/70">本册生字已全部通关，可复习任意一课 ✨</p>
        ) : currentNode ? (
          <>
            <p className="text-[11px] font-semibold text-amber-700">
              第{currentNode.unit}单元 · {display?.label ?? currentNode.lessonTitle}
            </p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">{currentNode.lessonTitle}</p>

            {total > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: lessonDone
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    }}
                  />
                </div>
                <span
                  className={`shrink-0 text-xs font-extrabold ${lessonDone ? 'text-green-600' : 'text-amber-700'}`}
                >
                  {done}/{total}
                </span>
              </div>
            )}

            {previewChars.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {previewChars.slice(0, 6).map((item) => (
                  <span
                    key={`${item.ch}-${item.isWrite ? 'w' : 'r'}`}
                    className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${
                      item.done
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 line-through opacity-80'
                        : 'border-amber-200 bg-white/80 text-slate-800'
                    }`}
                  >
                    {item.ch}
                    {item.isWrite && <span className="ml-0.5 text-[9px] text-rose-500">写</span>}
                  </span>
                ))}
                {previewChars.length > 6 && (
                  <span className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                    +{previewChars.length - 6}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs font-medium text-amber-800/70">字库加载中，请稍候…</p>
        )}
      </div>
    </Link>
  )
}
