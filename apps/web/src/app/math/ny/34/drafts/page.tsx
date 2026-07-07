'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson34-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/34"
      lessonId="34"
      problems={PROBLEMS}
    />
  )
}
