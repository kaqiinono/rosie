'use client'

import LessonProblemList from '@rosie/math-kit/components/shared/LessonProblemList'
import type { Problem } from '@rosie/core'
import { TAG_STYLE } from '@rosie/math-content/utils/g2/lesson9-data'

type Props = {
  problems: Problem[]
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList(props: Props) {
  return <LessonProblemList {...props} lessonId="2-9" tagStyles={TAG_STYLE} />
}
