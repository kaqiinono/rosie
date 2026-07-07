'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson51-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/51"
      lessonId="51"
      problems={PROBLEMS}
    />
  )
}
