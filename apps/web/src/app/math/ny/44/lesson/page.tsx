'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson44-data'
import { useLesson44 } from '@rosie/math/components/lesson44/Lesson44Provider'
import ProblemList from '@rosie/math/components/lesson44/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson44()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-[#e0e7ff] p-4">
        <div className="mb-1 text-sm font-extrabold text-indigo-900">📖 课堂讲解 · 第44讲</div>
        <div className="mb-2 text-xs text-indigo-700">{total}道题 · 合理安排·排队·刷漆·过河·烙饼·路径</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-indigo-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-indigo-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/44/lesson" />
    </div>
  )
}
