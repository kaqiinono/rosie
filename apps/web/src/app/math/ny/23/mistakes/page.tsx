'use client'

import { useLesson23 } from '@rosie/math/components/lesson23/Lesson23Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson23-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson23()
  return (
    <LessonMistakesPage
      basePath="/math/ny/23"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
