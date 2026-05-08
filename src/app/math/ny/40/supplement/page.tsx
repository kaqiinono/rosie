'use client'

import { PROBLEMS } from '@/utils/lesson40-data'
import { useLesson40 } from '@/components/math/lesson40/Lesson40Provider'
import ProblemList from '@/components/math/lesson40/ProblemList'

export default function SupplementPage() {
  const { solveCount } = useLesson40()
  const list = PROBLEMS.supplement ?? []
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered  = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fef3c7] p-4">
        <div className="mb-1 text-sm font-extrabold text-amber-900">📒 附加题 · 第40讲</div>
        <div className="mb-2 text-xs text-amber-700">{total}道附加题 · 深度提升</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-amber-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-amber-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/40/supplement" />
    </div>
  )
}
