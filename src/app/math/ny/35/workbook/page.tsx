'use client'

import { PROBLEMS } from '@/utils/lesson35-data'
import { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import ProblemList from '@/components/math/lesson35/ProblemList'

export default function WorkbookPage() {
  const { solved } = useLesson35()
  return (
    <div>
      <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="text-sm font-bold">📚 练习册闯关 · 12关</div>
        <div className="mt-1 text-xs text-text-muted">每一关都是新挑战，你能全部通关吗？</div>
      </div>
      <ProblemList problems={PROBLEMS.workbook} solved={solved} basePath="/math/ny/35/workbook" />
    </div>
  )
}
