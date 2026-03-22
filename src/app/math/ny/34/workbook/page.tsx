'use client'

import { PROBLEMS } from '@/utils/lesson34-data'
import { useLesson34 } from '@/components/math/lesson34/Lesson34Provider'
import ProblemList from '@/components/math/lesson34/ProblemList'

export default function WorkbookPage() {
  const { solveCount } = useLesson34()
  const list = PROBLEMS.workbook
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="mb-1 text-sm font-bold">📚 拓展练习 · {total}道闯关题</div>
        <div className="mb-2 text-xs text-text-muted">综合挑战，检验实力</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gray-300 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-app-purple transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }}
            />
          </div>
          <div className="shrink-0 text-xs font-bold text-text-secondary">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/34/workbook" />
    </div>
  )
}
