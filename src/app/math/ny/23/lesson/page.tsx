'use client'

import { PROBLEMS } from '@/utils/lesson23-data'
import { useLesson23 } from '@/components/math/lesson23/Lesson23Provider'
import ProblemList from '@/components/math/lesson23/ProblemList'

export default function LessonPage() {
  const { solveCount } = useLesson23()
  const list = PROBLEMS.lesson
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-violet-200 bg-gradient-to-br from-violet-50 to-[#ede9fe] p-4">
        <div className="mb-1 text-sm font-extrabold text-violet-900">📖 课堂讲解 · 第23讲</div>
        <div className="mb-2 text-xs text-violet-700">{total}道题 · 五大推理方法 · 例题+练一练</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-violet-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-violet-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-violet-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/23/lesson" />
    </div>
  )
}
