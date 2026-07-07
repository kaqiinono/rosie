'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson41-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/41"
      lessonId="41"
      problems={PROBLEMS}
    />
  )
}
