'use client'

import { useRouter } from 'next/navigation'
import type { MasteryLevel, Problem } from '@rosie/core'
import { MASTERY_ICON, MASTERY_BADGE_BG } from '@rosie/core'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import { problemCardDisplayId } from '../../utils/problem-display-id'

type LessonProblemDetailHeaderProps = {
  problemId: string
  title: string
  masteryLevel: MasteryLevel
  practiceCount: number
  /** Provides the business display number when it differs from the stored ID. */
  problem?: Problem
}

export default function LessonProblemDetailHeader({
  problemId,
  title,
  masteryLevel,
  practiceCount,
  problem,
}: LessonProblemDetailHeaderProps) {
  const router = useRouter()

  return (
    <div className="mb-4 space-y-3 border-b border-border-light pb-3.5">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="返回上一页"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-surface-dim text-text-secondary hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-app-blue"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-9 items-start gap-2">
            <span className="mt-1 flex h-8 min-w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-app-blue-light px-2 text-xs font-semibold tabular-nums text-app-blue-dark">
              {problemCardDisplayId(problem ?? { id: problemId })}
            </span>
            <div className="min-w-0 flex-1 pt-1 text-[17px] font-bold leading-snug break-words">{title}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <PracticeCountBadge count={practiceCount} compact />
          </div>
        </div>
        <div
          className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-1.5 text-sm font-bold ${MASTERY_BADGE_BG[masteryLevel]}`}
        >
          {MASTERY_ICON[masteryLevel] || '·'}
        </div>
      </div>
    </div>
  )
}
