'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson52-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/52"
      lessonId="52"
      problems={PROBLEMS}
    />
  )
}
