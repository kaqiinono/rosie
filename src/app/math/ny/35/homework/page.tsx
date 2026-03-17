'use client'

import { PROBLEMS } from '@/utils/lesson35-data'
import { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import ProblemList from '@/components/math/lesson35/ProblemList'

export default function HomeworkPage() {
  const { solved } = useLesson35()
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="text-sm font-bold">✏️ 课后巩固 · 6道练习</div>
        <div className="mt-1 text-xs text-text-muted">巩固今天学到的归一技巧</div>
      </div>
      <ProblemList problems={PROBLEMS.homework} solved={solved} basePath="/math/ny/35/homework" />
    </div>
  )
}
