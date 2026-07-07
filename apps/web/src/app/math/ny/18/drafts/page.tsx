'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson18-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/18"
      lessonId="18"
      problems={PROBLEMS}
    />
  )
}
