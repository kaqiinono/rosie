'use client'

import type { ReactNode } from 'react'
import LessonMaterials from './LessonMaterials'
import { LessonSummaryVideos, LessonVideoReplay } from './ProblemVideoReplay'

export default function LessonHomeTitle({ lessonKey, className, children, summaryInContent = false }: {
  lessonKey: string; className: string; children: ReactNode; summaryInContent?: boolean
}) {
  return (
    <div className="relative mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h1 className={className}>{children}</h1>
      <div role="group" aria-label="讲次资源" className="flex flex-wrap items-center gap-2">
        <LessonVideoReplay lessonKey={lessonKey} />
        <LessonMaterials lessonKey={lessonKey} />
      </div>
      {!summaryInContent && <LessonSummaryVideos lessonKey={lessonKey} />}
    </div>
  )
}
