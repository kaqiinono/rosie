'use client'

import { useLesson36 } from '@rosie/math/components/lesson36/Lesson36Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson36-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson36()
  return (
    <LessonMistakesPage
      basePath="/math/ny/36"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
