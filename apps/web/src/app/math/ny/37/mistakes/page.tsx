'use client'

import { useLesson37 } from '@rosie/math/components/lesson37/Lesson37Provider'
import { PROBLEMS, TAG_STYLE } from '@rosie/math/utils/lesson37-data'
import LessonMistakesPage from '@rosie/math/components/shared/LessonMistakesPage'

export default function MistakesPage() {
  const { wrongIds, removeWrong, solveCount } = useLesson37()
  return (
    <LessonMistakesPage
      basePath="/math/ny/37"
      problems={PROBLEMS}
      tagStyle={TAG_STYLE}
      wrongIds={wrongIds}
      solveCount={solveCount}
      removeWrong={removeWrong}
    />
  )
}
