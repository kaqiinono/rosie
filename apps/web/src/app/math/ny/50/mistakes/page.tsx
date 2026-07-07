'use client'

import { useLesson50 } from '@rosie/math/components/lesson50/Lesson50Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson50-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson50()
  return (
    <LessonMistakesPage
      basePath="/math/ny/50"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
