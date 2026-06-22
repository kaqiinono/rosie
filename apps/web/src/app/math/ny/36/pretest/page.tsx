'use client'

import { PROBLEMS } from '@/utils/lesson36-data'
import { useLesson36 } from '@/components/math/lesson36/Lesson36Provider'
import ProblemList from '@/components/math/lesson36/ProblemList'

export default function PretestPage() {
  const { solveCount } = useLesson36()
  const pretestMastered = PROBLEMS.pretest.filter(p => (solveCount[p.id] ?? 0) >= 3).length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-yellow-light p-4">
        <div className="mb-1 text-sm font-extrabold text-[#92400e]">📝 课前测 · 第36讲</div>
        <div className="mb-2 text-xs text-[#a16207]">一年级目标班 · 春季 · 做完5道题看看你的起点！</div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-[#fde68a]">
            <div
              className="h-full rounded-sm bg-yellow transition-[width] duration-400"
              style={{ width: `${Math.round((pretestMastered / 5) * 100)}%` }}
            />
          </div>
          <div className="text-xs font-bold text-[#92400e]">✅ {pretestMastered}/5</div>
        </div>
      </div>
      <ProblemList problems={PROBLEMS.pretest} solveCount={solveCount} basePath="/math/ny/36/pretest" />
    </div>
  )
}
