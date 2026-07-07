'use client'

import { useLesson13 } from '@rosie/math/components/lesson13/Lesson13Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson13-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson13()
  return (
    <LessonMistakesPage
      basePath="/math/ny/13"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
