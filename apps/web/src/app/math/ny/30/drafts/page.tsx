'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson30-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/30"
      lessonId="30"
      problems={PROBLEMS}
    />
  )
}
