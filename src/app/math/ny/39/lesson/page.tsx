'use client'

import { PROBLEMS } from '@/utils/lesson39-data'
import { useLesson39 } from '@/components/math/lesson39/Lesson39Provider'
import ProblemList from '@/components/math/lesson39/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson39()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-blue-200 bg-gradient-to-br from-blue-50 to-[#dbeafe] p-4">
        <div className="mb-1 text-sm font-extrabold text-blue-900">📖 课堂讲解 · 第39讲</div>
        <div className="mb-2 text-xs text-blue-700">{total}道例题 · 盈盈/盈恰/亏恰问题</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-blue-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-blue-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/39/lesson" />
    </div>
  )
}
