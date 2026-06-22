'use client'

import { PROBLEMS } from '@/utils/lesson34-data'
import { useLesson34 } from '@/components/math/lesson34/Lesson34Provider'
import ProblemList from '@/components/math/lesson34/ProblemList'

export default function SupplementPage() {
  const { solveCount } = useLesson34()
  const list = PROBLEMS.supplement ?? []
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fef3c7] p-4">
        <div className="mb-1 text-sm font-extrabold text-amber-900">📒 补充题 · 第34讲</div>
        <div className="mb-2 text-xs text-amber-700">
          100道速算训练 · 全部使用乘法分配律 · 熟能生巧，越练越快！
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-amber-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }}
            />
          </div>
          <div className="text-xs font-bold text-amber-800">✅ {mastered}/{total}</div>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/60 p-2.5">
          <span className="shrink-0 text-sm">💡</span>
          <span className="text-[11px] leading-relaxed text-amber-800">
            训练要点：看到 A×N±B×N 的形式，立刻提取公因数 N，凑成整百整千再计算。
          </span>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/34/supplement" />
    </div>
  )
}
