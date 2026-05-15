'use client'

import { PROBLEMS } from '@/utils/lesson42-data'
import { useLesson42 } from '@/components/math/lesson42/Lesson42Provider'
import ProblemList from '@/components/math/lesson42/ProblemList'

export default function WorkbookPage() {
  const { solveCount } = useLesson42()
  const list = PROBLEMS.workbook
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-purple-200 bg-gradient-to-br from-purple-50 to-[#ede9fe] p-4">
        <div className="mb-1 text-sm font-extrabold text-purple-900">📚 拓展练习 · 第42讲</div>
        <div className="text-xs text-purple-700">暂未上线 · 后续补充</div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/42/workbook" />
    </div>
  )
}
