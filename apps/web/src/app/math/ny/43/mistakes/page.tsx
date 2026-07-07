'use client'

import { useLesson43 } from '@rosie/math/components/lesson43/Lesson43Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson43-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson43()
  return (
    <LessonMistakesPage
      basePath="/math/ny/43"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
