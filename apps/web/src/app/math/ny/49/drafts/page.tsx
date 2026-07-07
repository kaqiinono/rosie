'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson49-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/49"
      lessonId="49"
      problems={PROBLEMS}
    />
  )
}
