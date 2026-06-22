'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import { useLesson29 } from '@rosie/math/components/lesson29/Lesson29Provider'
import ProblemList from '@rosie/math/components/lesson29/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson29()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-rose-200 bg-gradient-to-br from-rose-50 to-[#ffe4e6] p-4">
        <div className="mb-1 text-sm font-extrabold text-rose-900">📖 课堂讲解 · 第29讲</div>
        <div className="mb-2 text-xs text-rose-700">{total}道题 · 填算符 + 24点游戏</div>
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
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/29/lesson" />
    </div>
  )
}
