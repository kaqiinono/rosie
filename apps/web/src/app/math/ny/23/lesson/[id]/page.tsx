'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson23-data'
import ProblemDetail from '@rosie/math/components/lesson23/ProblemDetail'
export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/23"
      section="lesson"
      problems={PROBLEMS.lesson}
      Detail={ProblemDetail}
    />
  )
}
