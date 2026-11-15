'use client'

import type { ReactNode } from 'react'
import LessonMaterials from './LessonMaterials'
import { LessonSummaryVideos, LessonVideoReplay } from './ProblemVideoReplay'

export default function LessonHomeTitle({
  lessonKey,
  className,
  children,
  summaryInContent = false,
  description,
}: {
  lessonKey: string
  className: string
  children: ReactNode
  summaryInContent?: boolean
  description?: ReactNode
}) {
  const resources = (
    <div role="group" aria-label="讲次资源" className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <LessonVideoReplay lessonKey={lessonKey} />
      <LessonMaterials lessonKey={lessonKey} />
    </div>
  )
  if (description) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="max-w-3xl">
          <h1 className={className}>{children}</h1>
          <div className="mt-2">{description}</div>
        </div>
        {resources}
        {!summaryInContent && <LessonSummaryVideos lessonKey={lessonKey} />}
      </div>
    )
  }
  return (
    <div className="relative mb-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <h1 className={className}>{children}</h1>
      {resources}
      {!summaryInContent && <LessonSummaryVideos lessonKey={lessonKey} />}
    </div>
  )
}
