'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson51-data'
import { useLesson51 } from '@rosie/math/components/lesson51/Lesson51Provider'
import ProblemList from '@rosie/math/components/lesson51/ProblemList'

export default function WorkbookPage() {
  const { solveCount } = useLesson51()
  const list = PROBLEMS.workbook
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-purple-200 bg-gradient-to-br from-purple-50 to-[#f3e8ff] p-4">
        <div className="mb-1 text-sm font-extrabold text-purple-900">📚 拓展练习 · 第51讲</div>
        <div className="mb-2 text-xs text-purple-700">{total > 0 ? `${total}道闯关挑战` : '本讲暂无拓展练习题'}</div>
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
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/51/workbook" />
    </div>
  )
}
