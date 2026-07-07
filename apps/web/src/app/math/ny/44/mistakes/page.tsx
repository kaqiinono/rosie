'use client'

import { useLesson44 } from '@rosie/math/components/lesson44/Lesson44Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson44-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson44()
  return (
    <LessonMistakesPage
      basePath="/math/ny/44"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
