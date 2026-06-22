'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson12-data'
import { useLesson12 } from '@rosie/math/components/lesson12/Lesson12Provider'
import ProblemList from '@rosie/math/components/lesson12/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson12()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-orange-200 bg-gradient-to-br from-orange-50 to-[#ffedd5] p-4">
        <div className="mb-1 text-sm font-extrabold text-orange-900">📖 课堂讲解 · 第12讲</div>
        <div className="mb-2 text-xs text-orange-700">{total}道题 · 凑整+花减+括号+归整+等差</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-orange-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-orange-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-orange-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/12/lesson" />
    </div>
  )
}
