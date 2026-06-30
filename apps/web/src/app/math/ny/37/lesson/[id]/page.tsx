'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS, LESSON_TIP } from '@rosie/math/utils/lesson37-data'
import ProblemDetail from '@rosie/math/components/lesson37/ProblemDetail'
export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/37"
      section="lesson"
      problems={PROBLEMS.lesson}
      Detail={ProblemDetail}
      detailProps={{ tip: LESSON_TIP }}
    />
  )
}
