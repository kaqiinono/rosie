'use client'

import { useLesson55 } from '@rosie/math/components/lesson55/Lesson55Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson55-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson55()
  return (
    <LessonMistakesPage
      basePath="/math/ny/55"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
