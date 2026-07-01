'use client'

import { useChineseContext } from '../context/ChineseContext'
import { CHINESE_PLAN_DEFAULTS } from '../utils/chineseWeeklyPlan'

export default function ChineseWeeklyPage() {
  const {
    weeklyPlan,
    generatePlan,
    defaultParams,
    isPlanLoading,
    lessonGroups,
    isCharDataReady,
  } = useChineseContext()
  const params = defaultParams ?? CHINESE_PLAN_DEFAULTS
  const firstLessonKey = lessonGroups[0]?.lessonKey

  if (isPlanLoading) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  if (!isCharDataReady) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，无法生成周计划。请先灌入 Supabase 字表数据。
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-extrabold text-slate-900">周计划</h1>
      <p className="mt-1 text-sm text-slate-500">
        每周从周四开始 · 每日 {params.newRecognizePerDay} 认读 + {params.newWritePerDay} 会写
      </p>

      {!weeklyPlan ? (
        <button
          type="button"
          onClick={() => void generatePlan(firstLessonKey)}
          className="mt-6 w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white"
        >
          生成本周计划
        </button>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold text-amber-800">
            本周起始：{weeklyPlan.weekStart} · 从 {weeklyPlan.lessonKey} 开始
          </p>
          <ul className="space-y-2">
            {weeklyPlan.days.map((day) => (
              <li
                key={day.date}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <div className="font-bold text-slate-800">{day.date}</div>
                <div className="mt-1 text-xs text-slate-500">
                  认读 {day.newRecognizeKeys.length} · 会写 {day.newWriteKeys.length}
                  {weeklyPlan.progress[day.date]?.quizDone && (
                    <span className="ml-2 text-emerald-600">✓ 已完成测验</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void generatePlan(weeklyPlan.lessonKey)}
            className="w-full rounded-xl border border-amber-300 py-2.5 text-sm font-bold text-amber-800"
          >
            重新生成本周计划
          </button>
        </div>
      )}
    </div>
  )
}
