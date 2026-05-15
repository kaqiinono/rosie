'use client'

import { PROBLEMS } from '@/utils/lesson42-data'
import { useLesson42 } from '@/components/math/lesson42/Lesson42Provider'
import ProblemList from '@/components/math/lesson42/ProblemList'

export default function HomeworkPage() {
  const { solveCount } = useLesson42()
  const list = PROBLEMS.homework
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-green-200 bg-gradient-to-br from-green-50 to-[#dcfce7] p-4">
        <div className="mb-1 text-sm font-extrabold text-green-900">✏️ 课后巩固 · 第42讲</div>
        <div className="text-xs text-green-700">暂未上线 · 后续补充</div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/42/homework" />
    </div>
  )
}
