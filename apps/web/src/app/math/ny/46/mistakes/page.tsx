'use client'

import { useLesson46 } from '@rosie/math/components/lesson46/Lesson46Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson46-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson46()
  return (
    <LessonMistakesPage
      basePath="/math/ny/46"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
