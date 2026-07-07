'use client'

import { useLesson52 } from '@rosie/math/components/lesson52/Lesson52Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson52-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson52()
  return (
    <LessonMistakesPage
      basePath="/math/ny/53/52"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
