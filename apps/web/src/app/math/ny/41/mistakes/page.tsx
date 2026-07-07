'use client'

import { useLesson41 } from '@rosie/math/components/lesson41/Lesson41Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson41-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson41()
  return (
    <LessonMistakesPage
      basePath="/math/ny/41"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
