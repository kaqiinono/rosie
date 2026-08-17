'use client'

import LessonProblemList from '@rosie/math-kit/components/shared/LessonProblemList'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math-content/utils/g2/lesson5-data'

type Props = {
  problems: Problem[]
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList({
  problems,
  practiceCount,
  correctCount,
  basePath,
  showSource,
  sourceLabel,
}: Props) {
  return (
    <LessonProblemList
      problems={problems}
      practiceCount={practiceCount}
      correctCount={correctCount}
      basePath={basePath}
      lessonId="2-5"
      tagStyles={TAG_STYLE}
      showSource={showSource}
      sourceLabel={sourceLabel}
    />
  )
}
