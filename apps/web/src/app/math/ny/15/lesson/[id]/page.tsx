'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson15-data'
import ProblemDetail from '@rosie/math/components/lesson15/ProblemDetail'
export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/15"
      section="lesson"
      problems={PROBLEMS.lesson}
      Detail={ProblemDetail}
    />
  )
}
