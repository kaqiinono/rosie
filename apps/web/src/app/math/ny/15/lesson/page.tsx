'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson15-data'
import { useLesson15 } from '@rosie/math/components/lesson15/Lesson15Provider'
import ProblemList from '@rosie/math/components/lesson15/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson15()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-sky-200 bg-gradient-to-br from-sky-50 to-[#e0f2fe] p-4">
        <div className="mb-1 text-sm font-extrabold text-sky-900">📖 课堂讲解 · 第15讲</div>
        <div className="mb-2 text-xs text-sky-700">{total}道题 · 例题 + 练一练 · 5大题型全覆盖</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-sky-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-sky-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-sky-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-sky-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/15/lesson" />
    </div>
  )
}
