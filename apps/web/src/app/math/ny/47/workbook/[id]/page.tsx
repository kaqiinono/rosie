'use client'
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS } from '@rosie/math/utils/lesson47-data'
import ProblemDetail from '@rosie/math/components/lesson47/ProblemDetail'
export default function WorkbookProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/47"
      section="workbook"
      problems={PROBLEMS.workbook}
      Detail={ProblemDetail}
    />
  )
}
