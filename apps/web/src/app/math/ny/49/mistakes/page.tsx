'use client'

import { useLesson49 } from '@rosie/math/components/lesson49/Lesson49Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson49-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson49()
  return (
    <LessonMistakesPage
      basePath="/math/ny/49"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
