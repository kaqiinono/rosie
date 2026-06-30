'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson39-data'
import ProblemDetail from '@rosie/math/components/lesson39/ProblemDetail'
export default function HomeworkProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/39"
      section="homework"
      problems={PROBLEMS.homework}
      Detail={ProblemDetail}
    />
  )
}
