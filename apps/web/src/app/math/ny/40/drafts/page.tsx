'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson40-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/40"
      lessonId="40"
      problems={PROBLEMS}
    />
  )
}
