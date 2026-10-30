'use client'

import type { Problem } from '@rosie/core'
import LessonProblemList from '@rosie/math-kit/components/shared/LessonProblemList'
import { TAG_STYLE } from '../../../../utils/g2/lesson12-data'

type Props = {
  problems: Problem[]
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}
export default function ProblemList(props: Props) {
  return <LessonProblemList {...props} lessonId="2-12" tagStyles={TAG_STYLE} />
}
