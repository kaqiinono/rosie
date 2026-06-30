'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import ProblemDetail from '@rosie/math/components/lesson37/ProblemDetail'
export default function SupplementProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/37"
      section="supplement"
      problems={PROBLEMS.supplement ?? []}
      Detail={ProblemDetail}
    />
  )
}
