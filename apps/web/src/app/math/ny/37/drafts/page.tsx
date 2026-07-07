'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/37"
      lessonId="37"
      problems={PROBLEMS}
    />
  )
}
