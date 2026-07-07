'use client'

import { useLesson18 } from '@rosie/math/components/lesson18/Lesson18Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson18-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson18()
  return (
    <LessonMistakesPage
      basePath="/math/ny/18"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
