'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson42-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/42"
      lessonId="42"
      problems={PROBLEMS}
    />
  )
}
