'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import type { Problem } from '@rosie/core'
import type { ComponentType } from 'react'
import { getProblemNav } from '@rosie/math/utils/problem-nav'
import { ProblemScratchProvider } from '@rosie/math/components/shared/ScratchPad/ProblemScratchContext'
import { LessonScratchActionsProvider } from '@rosie/math/components/shared/ScratchPad/LessonScratchActionsContext'

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
  params: Promise<{ id: string }>
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
  params,
  basePath,
  section,
  problems,
  Detail,
  detailProps,
  scratchActions,
}: LessonProblemRoutePageProps) {
  const { id } = use(params)
  const id1 = parseInt(id, 10)
  if (Number.isNaN(id1) || id1 < 1) notFound()
  const problem = problems[id1 - 1]
  if (!problem) notFound()

  const { prevHref, nextHref, positionLabel } = getProblemNav(basePath, section, id1, problems.length)

  return (
    <ProblemScratchProvider
      value={{
        sectionProblems: problems,
        section,
        problemIndex: id1 - 1,
        basePath,
      }}
    >
      <LessonScratchActionsProvider
        value={
          scratchActions ?? {
            onSolve: async () => {},
            onWrong: () => {},
            onResolved: async () => {},
          }
        }
      >
        <Detail
          problem={problem}
          prevHref={prevHref}
          nextHref={nextHref}
          positionLabel={positionLabel}
          scratchActions={scratchActions}
          {...detailProps}
        />
      </LessonScratchActionsProvider>
    </ProblemScratchProvider>
  )
}
