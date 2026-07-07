'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson35-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/35"
      lessonId="35"
      problems={PROBLEMS}
    />
  )
}
