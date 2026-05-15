'use client'

import { PROBLEMS } from '@/utils/lesson42-data'
import { useLesson42 } from '@/components/math/lesson42/Lesson42Provider'
import ProblemList from '@/components/math/lesson42/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson42()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-rose-200 bg-gradient-to-br from-rose-50 to-[#fee2e2] p-4">
        <div className="mb-1 text-sm font-extrabold text-rose-900">📖 课堂讲解 · 第42讲</div>
        <div className="mb-2 text-xs text-rose-700">{total}道例题 · 覆盖砝码称重/公平分账/空瓶换水/计时量水/天平找异物 5 大题型</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-rose-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-rose-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-rose-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-rose-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/42/lesson" />
    </div>
  )
}
