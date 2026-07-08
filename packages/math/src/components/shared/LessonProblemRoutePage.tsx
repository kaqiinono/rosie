'use client'

import { useMemo } from 'react'
import type { Problem } from '@rosie/core'
import type { ComponentType } from 'react'
import { getProblemNav } from '@rosie/math/utils/problem-nav'
import { ProblemScratchProvider } from '@rosie/math/components/shared/ScratchPad/ProblemScratchContext'

export type ProblemDetailComponentProps = {
  problem: Problem
  mode?: 'full' | 'inline'
  defaultSolutionOpen?: boolean
  tip?: string
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
  scratchActions?: {
    onSolve: (problemId: string) => void | Promise<void>
    onWrong: (problemId: string) => void
    onResolved: (problemId: string) => void | Promise<void>
  }
}

type LessonProblemRoutePageProps = {
  problemId: string
  basePath: string
  section: string
  problems: Problem[]
  Detail: ComponentType<ProblemDetailComponentProps>
  detailProps?: Omit<
    ProblemDetailComponentProps,
    'problem' | 'prevHref' | 'nextHref' | 'positionLabel' | 'scratchActions'
  >
  scratchActions?: ProblemDetailComponentProps['scratchActions']
}

export default function LessonProblemRoutePage({
  problemId,
  basePath,
  section,
  problems,
  Detail,
  detailProps,
  scratchActions,
}: LessonProblemRoutePageProps) {
  const id1 = parseInt(problemId, 10)
  const problem = Number.isNaN(id1) || id1 < 1 ? undefined : problems[id1 - 1]

  if (!problem) {
    return (
      <div className="py-10 text-center text-sm text-text-muted">
        题目不存在或已移除。
      </div>
    )
  }

  const { prevHref, nextHref, positionLabel } = getProblemNav(basePath, section, id1, problems.length)

  const scratchValue = useMemo(
    () => ({
      sectionProblems: problems,
      section,
      problemIndex: id1 - 1,
      basePath,
    }),
    [problems, section, id1, basePath],
  )

  return (
    <ProblemScratchProvider value={scratchValue}>
      <Detail
        key={problemId}
        problem={problem}
        prevHref={prevHref}
        nextHref={nextHref}
        positionLabel={positionLabel}
        scratchActions={scratchActions}
        {...detailProps}
      />
    </ProblemScratchProvider>
  )
}
