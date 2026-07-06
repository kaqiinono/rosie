'use client'

import { useRouter } from 'next/navigation'
import type { MasteryLevel, Problem } from '@rosie/core'
import { MASTERY_ICON, MASTERY_BADGE_BG } from '@rosie/core'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import AnalysisGuideBadgeForProblem from '@rosie/math/components/shared/AnalysisGuideBadgeForProblem'

type LessonProblemDetailHeaderProps = {
  problemId: string
  title: string
  masteryLevel: MasteryLevel
  practiceCount: number
  /** When provided, shows 📊 图解 badge if this problem has an analysis image. */
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
    <div className="mb-4 flex items-center gap-2.5 border-b border-border-light pb-3.5">
      <button
        onClick={() => router.back()}
        className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-gray-100 text-lg transition-colors hover:bg-gray-200"
      >
        ‹
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[17px] font-bold">{title}</div>
          {problem && <AnalysisGuideBadgeForProblem problem={problem} size="md" />}
        </div>
        <div className="mt-1">
          <PracticeCountBadge count={practiceCount} />
        </div>
      </div>
      <FavoriteHeart problemId={problemId} size="md" />
      <div
        className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1.5 text-sm font-bold ${MASTERY_BADGE_BG[masteryLevel]}`}
      >
        {MASTERY_ICON[masteryLevel] || '·'}
      </div>
    </div>
  )
}
