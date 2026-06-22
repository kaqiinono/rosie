'use client'

import LessonProblemList from '@/components/math/shared/LessonProblemList'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@/utils/lesson30-data'

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
      lessonId="30"
      tagStyles={TAG_STYLE}
      showSource={showSource}
      sourceLabel={sourceLabel}
    />
  )
}
