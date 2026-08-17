'use client'

import { memo, type ComponentType } from 'react'
import Link from 'next/link'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@rosie/core'
import FavoriteHeart from '@rosie/math-kit/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import type { ProblemDetailComponentProps } from '@rosie/math-kit/components/shared/LessonProblemRoutePage'
import { SolutionAvailabilityOverride } from '@rosie/math-kit/components/shared/QuestionLayout'

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
  /** Primary card action. Use href for source lists and onActivate for aggregate practice pools. */
  href?: string
  onActivate?: () => void
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
  href,
  onActivate,
}: ExpandedProblemCardProps) {
  const count = solveCount[problem.id] ?? 0
  const level = getMasteryLevel(count)

  const cardBody = (
    <>
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
    </>
  )

  return (
    <div className={`self-start w-full rounded-[12px] border-[1.5px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${MASTERY_BORDER[level]}`}>
      <div className="flex items-center rounded-[12px] p-3">
        {href ? (
          <Link
            href={href}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left no-underline"
          >
            {cardBody}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
          >
            {cardBody}
          </button>
        )}
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <FavoriteHeart problemId={problem.id} size="sm" />
          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? '收起题解' : '展开题解'}
            aria-expanded={isOpen}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-slate-100"
          >
            <span className={`text-[13px] font-bold transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-border-light px-4 pb-5 pt-3">
          <SolutionAvailabilityOverride enabled={Boolean(defaultSolutionOpen)}>
            <ProblemDetail problem={problem} mode="inline" defaultSolutionOpen={defaultSolutionOpen} />
          </SolutionAvailabilityOverride>
        </div>
      )}
    </div>
  )
}

export default memo(ExpandedProblemCard)
