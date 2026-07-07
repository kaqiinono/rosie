'use client'

import { useLesson29 } from '@rosie/math/components/lesson29/Lesson29Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson29-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson29()
  return (
    <LessonMistakesPage
      basePath="/math/ny/29"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
