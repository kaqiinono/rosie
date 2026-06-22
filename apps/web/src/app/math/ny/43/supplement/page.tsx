'use client'

import { PROBLEMS } from '@/utils/lesson43-data'
import { useLesson43 } from '@/components/math/lesson43/Lesson43Provider'
import ProblemList from '@/components/math/lesson43/ProblemList'

export default function SupplementPage() {
  const { solveCount } = useLesson43()
  const list = PROBLEMS.supplement ?? []
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-teal-200 bg-gradient-to-br from-teal-50 to-[#ccfbf1] p-4">
        <div className="mb-1 text-sm font-extrabold text-teal-900">📒 附加题 · 第43讲</div>
        <div className="mb-2 text-xs text-teal-700">{total}道补充题 · 数列规律与求和</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-teal-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-teal-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-teal-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }} />
          </div>
          <div className="shrink-0 text-xs font-bold text-teal-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/43/supplement" />
    </div>
  )
}
