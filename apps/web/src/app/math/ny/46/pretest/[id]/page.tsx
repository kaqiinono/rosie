'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson46-data'
import ProblemDetail from '@rosie/math/components/lesson46/ProblemDetail'
export default function PretestProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/46"
      section="pretest"
      problems={PROBLEMS.pretest}
      Detail={ProblemDetail}
    />
  )
}
