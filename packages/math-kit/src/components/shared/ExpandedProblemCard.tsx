'use client'

import { memo, type ComponentType } from 'react'
import Link from 'next/link'
import type { Problem } from '@rosie/core'
import { getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import type { ProblemDetailComponentProps } from '@rosie/math-kit/components/shared/LessonProblemRoutePage'
import { SolutionAvailabilityOverride } from '@rosie/math-kit/components/shared/QuestionLayout'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import { problemPracticeStyle } from '../../utils/problem-practice-style'
import ProblemCardActions, { ExternalProblemActions } from './ProblemCardActions'
import { ProblemScratchProvider, type ProblemScratchContextValue } from './ScratchPad/ProblemScratchContext'

export type ProblemDetailInlineComponent = ComponentType<ProblemDetailComponentProps>

type ExpandedProblemCardProps = {
  problem: Problem
  index: number
  scratchContext?: ProblemScratchContextValue
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  hasAnalysis?: boolean
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
  practiceCount,
  scratchContext,
  correctCount,
  hasAnalysis = Boolean(problem.analysisImg),
  tagStyles,
  isOpen,
  onToggle,
  ProblemDetail,
  defaultSolutionOpen,
  sourceLabel,
  href,
  onActivate,
}: ExpandedProblemCardProps) {
  const count = practiceCount[problem.id] ?? 0
  const level = getMasteryLevel(correctCount[problem.id] ?? 0)
  const practiceStyle = problemPracticeStyle(count)

  const cardBody = (
    <>
      <div className="flex h-8 min-w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-app-blue-light px-2 text-xs font-semibold tabular-nums text-app-blue-dark">
        {problemCardDisplayId(problem)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-snug break-words text-text-primary">{problem.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-text-secondary">
          <span className={`rounded px-1.5 py-0.5 font-medium ${tagStyles[problem.tag] || 'bg-gray-100 text-gray-600'}`}>
            {problem.tagLabel}
          </span>
          <span className="shrink-0 font-medium tabular-nums">难度 {problem.difficulty}/5</span>
          {sourceLabel && (
            <span className="max-w-full truncate font-medium">
              {sourceLabel}
            </span>
          )}
          <PracticeCountBadge count={count} compact />
        </div>
      </div>
      <span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>
    </>
  )

  return (
    <div className={`relative top-0 self-start w-full min-w-0 rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[top,box-shadow] duration-200 hover:-top-0.5 hover:shadow-[0_5px_16px_rgba(59,130,246,0.09)] motion-reduce:transition-none motion-reduce:hover:top-0 ${practiceStyle.border}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full ${practiceStyle.accent}`} />
      <div className="flex items-start p-4">
        {href ? (
          <Link
            href={href}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-lg text-left no-underline focus-visible:outline-2 focus-visible:outline-app-blue"
          >
            {cardBody}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-app-blue"
          >
            {cardBody}
          </button>
        )}
      </div>
      {isOpen && (
        <div
          className={`border-t border-border-light px-4 pb-5 pt-3 ${defaultSolutionOpen ? '[&_.ql-answer]:hidden' : ''}`}
        >
          <SolutionAvailabilityOverride enabled={Boolean(defaultSolutionOpen)}>
            <ExternalProblemActions>
              <ProblemDetail problem={problem} mode="inline" defaultSolutionOpen={defaultSolutionOpen} />
            </ExternalProblemActions>
          </SolutionAvailabilityOverride>
        </div>
      )}
      <ProblemScratchProvider value={scratchContext ?? { sectionProblems: [problem], section: href?.split('/').at(-2) ?? 'lesson', problemIndex: 0, basePath: href?.replace(/\/[^/]+$/, '') ?? '' }}>
        <ProblemCardActions problem={problem} hasAnalysis={hasAnalysis} isOpen={isOpen} onToggle={onToggle} practiceCount={count} />
      </ProblemScratchProvider>
    </div>
  )
}

export default memo(ExpandedProblemCard)
