'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson13-data'
import ProblemDetail from '@rosie/math/components/lesson13/ProblemDetail'
export default function PretestProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/13"
      section="pretest"
      problems={PROBLEMS.pretest}
      Detail={ProblemDetail}
    />
  )
}
