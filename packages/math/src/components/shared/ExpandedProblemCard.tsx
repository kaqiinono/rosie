'use client'

import { memo, type ComponentType } from 'react'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import type { ProblemDetailComponentProps } from '@rosie/math/components/shared/LessonProblemRoutePage'

export type ProblemDetailInlineComponent = ComponentType<ProblemDetailComponentProps>

type ExpandedProblemCardProps = {
  problem: Problem
  index: number
  solveCount: Record<string, number>
  tagStyles: Record<string, string>
  isOpen: boolean
  onToggle: () => void
  ProblemDetail: ProblemDetailInlineComponent
  defaultSolutionOpen?: boolean
  sourceLabel?: string
  sourceBadgeClass?: string
}

function ExpandedProblemCard({
  problem,
  index,
  solveCount,
  tagStyles,
  isOpen,
  onToggle,
  ProblemDetail,
  defaultSolutionOpen,
  sourceLabel,
  sourceBadgeClass,
}: ExpandedProblemCardProps) {
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  return (
    <div className={`rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${MASTERY_BORDER[level]}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] p-3 text-left"
      >
        <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${MASTERY_BADGE_BG[level]}`}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-primary">{problem.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${tagStyles[problem.tag] || 'bg-gray-100 text-gray-600'}`}>
              {problem.tagLabel}
            </span>
            {sourceLabel && sourceBadgeClass && (
              <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${sourceBadgeClass}`}>
                {sourceLabel}
              </span>
            )}
            <PracticeCountBadge count={count} />
          </div>
        </div>
        <span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>
        <FavoriteHeart problemId={problem.id} size="sm" />
        <span className={`shrink-0 text-[13px] font-bold text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border-light px-4 pb-5 pt-3">
          <ProblemDetail problem={problem} mode="inline" defaultSolutionOpen={defaultSolutionOpen} />
        </div>
      )}
    </div>
  )
}

export default memo(ExpandedProblemCard)
