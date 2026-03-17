'use client'

import { PROBLEMS } from '@/utils/lesson35-data'
import { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import ProblemList from '@/components/math/lesson35/ProblemList'

export default function LessonPage() {
  const { solved } = useLesson35()
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="text-sm font-bold">📖 课堂讲解 · 6道例题</div>
        <div className="mt-1 text-xs text-text-muted">按顺序学习，点击题目开始互动</div>
      </div>
      <ProblemList problems={PROBLEMS.lesson} solved={solved} basePath="/math/ny/35/lesson" />
    </div>
  )
}
