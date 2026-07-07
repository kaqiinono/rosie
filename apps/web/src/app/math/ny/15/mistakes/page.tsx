'use client'

import { useLesson15 } from '@rosie/math/components/lesson15/Lesson15Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson15-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson15()
  return (
    <LessonMistakesPage
      basePath="/math/ny/15"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
