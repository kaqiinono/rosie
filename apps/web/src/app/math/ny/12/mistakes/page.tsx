'use client'

import { useLesson12 } from '@rosie/math/components/lesson12/Lesson12Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson12-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson12()
  return (
    <LessonMistakesPage
      basePath="/math/ny/12"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
