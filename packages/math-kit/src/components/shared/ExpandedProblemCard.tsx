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
import {
  ProblemScratchProvider,
  type ProblemScratchContextValue,
} from './ScratchPad/ProblemScratchContext'
import { Button } from '@rosie/ui/themes'

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
      <div className="bg-app-blue-light text-app-blue-dark flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold whitespace-nowrap tabular-nums">
        {problemCardDisplayId(problem)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text-primary text-sm leading-snug font-semibold break-words">
          {problem.title}
        </div>
        <div className="text-text-secondary mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]">
          <span
            className={`rounded px-1.5 py-0.5 font-medium ${tagStyles[problem.tag] || 'bg-gray-100 text-gray-600'}`}
          >
            {problem.tagLabel}
          </span>
          <span className="shrink-0 font-medium tabular-nums">难度 {problem.difficulty}/5</span>
          {sourceLabel && <span className="max-w-full truncate font-medium">{sourceLabel}</span>}
          <PracticeCountBadge count={count} compact />
        </div>
      </div>
      <span className="shrink-0 text-base">{MASTERY_ICON[level]}</span>
    </>
  )

  return (
    <div
      className={`shadow-sticker-sm hover:shadow-sticker-sm relative top-0 w-full min-w-0 self-start rounded-xl border bg-white transition-[top,box-shadow] duration-200 hover:-top-0.5 motion-reduce:transition-none motion-reduce:hover:top-0 ${practiceStyle.border}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full ${practiceStyle.accent}`}
      />
      <div className="flex items-start p-4">
        {href ? (
          <Link
            href={href}
            className="focus-visible:outline-app-blue flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-lg text-left no-underline focus-visible:outline-2"
          >
            {cardBody}
          </Link>
        ) : (
          <Button
            type="button"
            onClick={onActivate}
            variant="ghost"
            color="gray"
            size="2"
            className="min-w-0 flex-1"
          >
            {cardBody}
          </Button>
        )}
      </div>
      {isOpen && (
        <div
          className={`border-border-light border-t px-4 pt-3 pb-5 ${defaultSolutionOpen ? '[&_.ql-answer]:hidden' : ''}`}
        >
          <SolutionAvailabilityOverride enabled={Boolean(defaultSolutionOpen)}>
            <ExternalProblemActions>
              <ProblemDetail
                problem={problem}
                mode="inline"
                defaultSolutionOpen={defaultSolutionOpen}
              />
            </ExternalProblemActions>
          </SolutionAvailabilityOverride>
        </div>
      )}
      <ProblemScratchProvider
        value={
          scratchContext ?? {
            sectionProblems: [problem],
            section: href?.split('/').at(-2) ?? 'lesson',
            problemIndex: 0,
            basePath: href?.replace(/\/[^/]+$/, '') ?? '',
          }
        }
      >
        <ProblemCardActions
          problem={problem}
          hasAnalysis={hasAnalysis}
          isOpen={isOpen}
          onToggle={onToggle}
          practiceCount={count}
        />
      </ProblemScratchProvider>
    </div>
  )
}

export default memo(ExpandedProblemCard)
