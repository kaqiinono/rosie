'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson13-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/13"
      lessonId="13"
      problems={PROBLEMS}
    />
  )
}
