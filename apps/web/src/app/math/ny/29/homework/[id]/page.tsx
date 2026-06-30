'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import ProblemDetail from '@rosie/math/components/lesson29/ProblemDetail'
export default function HomeworkProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/29"
      section="homework"
      problems={PROBLEMS.homework}
      Detail={ProblemDetail}
    />
  )
}
