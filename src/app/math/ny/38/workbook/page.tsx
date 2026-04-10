'use client'

import { PROBLEMS } from '@/utils/lesson38-data'
import { useLesson38 } from '@/components/math/lesson38/Lesson38Provider'
import ProblemList from '@/components/math/lesson38/ProblemList'

export default function WorkbookPage() {
  const { solveCount } = useLesson38()
  const list = PROBLEMS.workbook
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-orange-200 bg-gradient-to-br from-orange-50 to-[#ffedd5] p-4">
        <div className="mb-1 text-sm font-extrabold text-orange-900">📚 拓展练习 · 第38讲</div>
        <div className="mb-2 text-xs text-orange-700">12道闯关题 · 综合挑战</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-orange-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-orange-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }}
            />
          </div>
          <div className="shrink-0 text-xs font-bold text-orange-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/38/workbook" />
    </div>
  )
}
