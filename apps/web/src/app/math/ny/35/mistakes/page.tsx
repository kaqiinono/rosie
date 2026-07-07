'use client'

import { useLesson35 } from '@rosie/math/components/lesson35/Lesson35Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson35-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson35()
  return (
    <LessonMistakesPage
      basePath="/math/ny/35"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
