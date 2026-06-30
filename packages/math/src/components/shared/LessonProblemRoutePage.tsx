'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import type { Problem } from '@rosie/core'
import type { ComponentType } from 'react'
import { getProblemNav } from '@rosie/math/utils/problem-nav'

export type ProblemDetailComponentProps = {
  problem: Problem
  mode?: 'full' | 'inline'
  defaultSolutionOpen?: boolean
  tip?: string
  prevHref?: string | null
  nextHref?: string | null
  positionLabel?: string
}

type LessonProblemRoutePageProps = {
  params: Promise<{ id: string }>
  basePath: string
  section: string
  problems: Problem[]
  Detail: ComponentType<ProblemDetailComponentProps>
  detailProps?: Omit<ProblemDetailComponentProps, 'problem' | 'prevHref' | 'nextHref' | 'positionLabel'>
}

export default function LessonProblemRoutePage({
  params,
  basePath,
  section,
  problems,
  Detail,
  detailProps,
}: LessonProblemRoutePageProps) {
  const { id } = use(params)
  const id1 = parseInt(id, 10)
  if (Number.isNaN(id1) || id1 < 1) notFound()
  const problem = problems[id1 - 1]
  if (!problem) notFound()

  const { prevHref, nextHref, positionLabel } = getProblemNav(basePath, section, id1, problems.length)

  return (
    <Detail
      problem={problem}
      prevHref={prevHref}
      nextHref={nextHref}
      positionLabel={positionLabel}
      {...detailProps}
    />
  )
}
