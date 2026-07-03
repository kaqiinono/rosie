'use client'

import LessonProblemList from '@rosie/math/components/shared/LessonProblemList'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math/utils/lesson52-data'

type Props = {
  problems: Problem[]
  solveCount: Record<string, number>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList({ problems, solveCount, basePath, showSource, sourceLabel }: Props) {
  return (
    <LessonProblemList
      problems={problems}
      solveCount={solveCount}
      basePath={basePath}
      lessonId="52"
      tagStyles={TAG_STYLE}
      showSource={showSource}
      sourceLabel={sourceLabel}
    />
  )
}
