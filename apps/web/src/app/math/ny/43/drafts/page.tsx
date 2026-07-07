'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson43-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/43"
      lessonId="43"
      problems={PROBLEMS}
    />
  )
}
