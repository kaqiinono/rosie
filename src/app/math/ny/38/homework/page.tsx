'use client'

import { PROBLEMS } from '@/utils/lesson38-data'
import { useLesson38 } from '@/components/math/lesson38/Lesson38Provider'
import ProblemList from '@/components/math/lesson38/ProblemList'

export default function HomeworkPage() {
  const { solveCount } = useLesson38()
  const list = PROBLEMS.homework
  const attempted = list.filter(p => (solveCount[p.id] ?? 0) >= 1).length
  const mastered = list.filter(p => (solveCount[p.id] ?? 0) >= 3).length
  const total = list.length

  return (
    <div>
      <div className="mb-3.5 rounded-[14px] border border-green-200 bg-gradient-to-br from-green-50 to-[#dcfce7] p-4">
        <div className="mb-1 text-sm font-extrabold text-green-900">✏️ 课后巩固 · 第38讲</div>
        <div className="mb-2 text-xs text-green-700">6道巩固题 · 一笔画判断 / 欧拉路径 / 棱爬行</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-green-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-green-200 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((attempted / total) * 100) : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-green-500 transition-[width] duration-400"
              style={{ width: `${total > 0 ? Math.round((mastered / total) * 100) : 0}%` }}
            />
          </div>
          <div className="shrink-0 text-xs font-bold text-green-700">
            练过 {attempted} · 🦋 {mastered}/{total}
          </div>
        </div>
      </div>
      <ProblemList problems={list} solveCount={solveCount} basePath="/math/ny/38/homework" />
    </div>
  )
}
