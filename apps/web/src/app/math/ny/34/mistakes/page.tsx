'use client'

import { useLesson34 } from '@rosie/math/components/lesson34/Lesson34Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson34-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson34()
  return (
    <LessonMistakesPage
      basePath="/math/ny/34"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
