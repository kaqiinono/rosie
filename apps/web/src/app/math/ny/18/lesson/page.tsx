'use client'

import { PROBLEMS } from '@/utils/lesson18-data'
import { useLesson18 } from '@/components/math/lesson18/Lesson18Provider'
import ProblemList from '@/components/math/lesson18/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson18()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-purple-200 bg-gradient-to-br from-purple-50 to-[#ede9fe] p-4">
        <div className="mb-1 text-sm font-extrabold text-purple-900">📖 课堂讲解 · 第18讲</div>
        <div className="mb-2 text-xs text-purple-700">{total}道题 · 六大题型例题 + 练一练</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-purple-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-purple-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-purple-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-purple-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/18/lesson" />
    </div>
  )
}
