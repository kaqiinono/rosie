'use client'

import { useLesson40 } from '@rosie/math/components/lesson40/Lesson40Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson40-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson40()
  return (
    <LessonMistakesPage
      basePath="/math/ny/40"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
