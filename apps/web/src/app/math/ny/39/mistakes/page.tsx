'use client'

import { useLesson39 } from '@rosie/math/components/lesson39/Lesson39Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson39-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson39()
  return (
    <LessonMistakesPage
      basePath="/math/ny/39"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
