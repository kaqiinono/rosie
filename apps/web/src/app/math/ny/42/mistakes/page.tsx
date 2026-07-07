'use client'

import { useLesson42 } from '@rosie/math/components/lesson42/Lesson42Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson42-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson42()
  return (
    <LessonMistakesPage
      basePath="/math/ny/42"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
