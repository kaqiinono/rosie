'use client'

import { useLesson47 } from '@rosie/math/components/lesson47/Lesson47Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson47-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson47()
  return (
    <LessonMistakesPage
      basePath="/math/ny/47"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
