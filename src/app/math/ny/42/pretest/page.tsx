'use client'

import { PROBLEMS } from '@/utils/lesson42-data'
import { useLesson42 } from '@/components/math/lesson42/Lesson42Provider'
import ProblemList from '@/components/math/lesson42/ProblemList'

export default function PretestPage() {
  const { solveCount } = useLesson42()
  const list = PROBLEMS.pretest
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-yellow-200 bg-gradient-to-br from-yellow-50 to-[#fef9c3] p-4">
        <div className="mb-1 text-sm font-extrabold text-yellow-900">📝 课前测 · 第42讲</div>
        <div className="text-xs text-yellow-700">暂未上线 · 后续补充</div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/42/pretest" />
    </div>
  )
}
