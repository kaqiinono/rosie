'use client'

import { useLesson51 } from '@rosie/math/components/lesson51/Lesson51Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson51-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson51()
  return (
    <LessonMistakesPage
      basePath="/math/ny/51"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
