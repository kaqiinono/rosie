'use client'

import { useLesson53 } from '@rosie/math/components/lesson53/Lesson53Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson53-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson53()
  return (
    <LessonMistakesPage
      basePath="/math/ny/53"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
