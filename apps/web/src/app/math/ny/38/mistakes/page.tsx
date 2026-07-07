'use client'

import { useLesson38 } from '@rosie/math/components/lesson38/Lesson38Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson38-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson38()
  return (
    <LessonMistakesPage
      basePath="/math/ny/38"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
