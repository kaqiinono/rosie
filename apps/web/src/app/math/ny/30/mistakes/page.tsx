'use client'

import { useLesson30 } from '@rosie/math/components/lesson30/Lesson30Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson30-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson30()
  return (
    <LessonMistakesPage
      basePath="/math/ny/30"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
