'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import ProblemDetail from '@rosie/math/components/lesson37/ProblemDetail'
export default function WorkbookProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/37"
      section="workbook"
      problems={PROBLEMS.workbook}
      Detail={ProblemDetail}
    />
  )
}
