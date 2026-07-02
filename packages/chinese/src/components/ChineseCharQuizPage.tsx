'use client'

import { useMemo } from 'react'
import { todayStr } from '@rosie/core'
import { CharQuizRunner, buildTodayQuizItems, useChineseContext } from '@rosie/chinese'

export default function ChineseCharQuizPage() {
  const { weeklyPlan, recordBatch, updateDayProgress, lessonGroups, charByKey, masteryMap, isCharDataReady } =
    useChineseContext()
  const today = todayStr()
  const todayPlan = weeklyPlan?.days.find((d) => d.date === today)

  const items = useMemo(
    () =>
      todayPlan && isCharDataReady
        ? buildTodayQuizItems(lessonGroups, charByKey, masteryMap, todayPlan, today)
        : [],
    [todayPlan, lessonGroups, charByKey, masteryMap, isCharDataReady, today],
  )

  const pinyinPool = useMemo(() => {
    const set = new Set(items.map((i) => i.pinyin))
    return [...set]
  }, [items])

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，请先在 Supabase 灌入一年级下册字表。
      </p>
    )
  }

  if (!todayPlan || items.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        今日暂无测验。请先在「今日」页生成本周计划。
      </p>
    )
  }

  const newCount = items.filter((i) => !i.isReview).length
  const reviewCount = items.filter((i) => i.isReview).length

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-center text-lg font-extrabold text-slate-800">拼音测验</h1>
      <p className="mb-6 text-center text-xs text-slate-500">
        新字 {newCount}
        {reviewCount > 0 ? ` · 复习 ${reviewCount}` : ''}
      </p>
      <CharQuizRunner
        items={items}
        pinyinPool={pinyinPool}
        onComplete={(results) => {
          const score =
            results.length > 0
              ? Math.round((results.filter((r) => r.correct).length / results.length) * 100)
              : 0
          recordBatch(
            results.map((r) => {
              const item = items.find((i) => i.charKey === r.charKey)
              return {
                charKey: r.charKey,
                track: item?.track ?? 'recognize',
                correct: r.correct,
              }
            }),
          )
          const prev = weeklyPlan?.progress[today]
          const now = new Date().toISOString()
          void updateDayProgress(today, {
            quizDone: true,
            lastScore: score,
            completedAt: now,
            practiceCount: Math.max(1, prev?.practiceCount ?? 1),
            lastPracticedAt: now,
          })
        }}
      />
    </div>
  )
}
